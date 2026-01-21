/**
 * Managed Server Registry
 *
 * Allows registering servers (ip + sourceDir) and checking online status.
 */

import { promises as fsp } from 'fs';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { v4 as uuidv4 } from 'uuid';

export interface ManagedServer {
  id: string;
  ip: string;
  sourceDir: string;
  name?: string;
  port?: number;
  createdAt: string;
}

export interface ServerStatus {
  id?: string;
  ip: string;
  online: boolean;
  ports: Record<number, boolean>;
  sourceDir: string;
  sourceDirExists: boolean;
  checkedAt: string;
}

export class ManagedServerRegistry {
  private filePath: string;
  private servers: Map<string, ManagedServer> = new Map();
  private loaded = false;

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), 'managed-servers.json');
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const data = await fsp.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data) as ManagedServer[];
      for (const s of parsed) this.servers.set(s.id, s);
    } catch (err) {
      // If file doesn't exist, start empty
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        // eslint-disable-next-line no-console
        console.error('Failed to load managed servers:', err);
      }
    } finally {
      this.loaded = true;
    }
  }

  private async persist(): Promise<void> {
    const list = Array.from(this.servers.values());
    await fsp.writeFile(this.filePath, JSON.stringify(list, null, 2), 'utf8');
  }

  async addServer(params: { ip: string; sourceDir: string; name?: string; port?: number }): Promise<ManagedServer> {
    await this.ensureLoaded();
    const server: ManagedServer = {
      id: uuidv4(),
      ip: params.ip,
      sourceDir: params.sourceDir,
      name: params.name,
      port: params.port,
      createdAt: new Date().toISOString()
    };
    this.servers.set(server.id, server);
    await this.persist();
    return server;
  }

  async removeServer(id: string): Promise<boolean> {
    await this.ensureLoaded();
    const removed = this.servers.delete(id);
    if (removed) await this.persist();
    return removed;
  }

  async listServers(): Promise<ManagedServer[]> {
    await this.ensureLoaded();
    return Array.from(this.servers.values());
  }

  async getServer(id: string): Promise<ManagedServer | undefined> {
    await this.ensureLoaded();
    return this.servers.get(id);
  }

  async checkStatus(input: { id?: string; ip?: string; sourceDir?: string; ports?: number[] }): Promise<ServerStatus> {
    await this.ensureLoaded();

    let ip = input.ip;
    let sourceDir = input.sourceDir;
    let id: string | undefined = input.id;

    if (input.id) {
      const found = this.servers.get(input.id);
      if (!found) {
        throw new Error(`Unknown managed server: ${input.id}`);
      }
      ip = found.ip;
      sourceDir = found.sourceDir;
      id = found.id;
    }

    if (!ip || !sourceDir) {
      throw new Error('Must provide either id or both ip and sourceDir');
    }

    // Use custom port if available, otherwise default to common ports
    let defaultPorts = [22, 80, 443];
    if (input.id) {
      const found = this.servers.get(input.id);
      if (found?.port) {
        defaultPorts = [found.port];
      }
    }
    const ports = input.ports && input.ports.length > 0 ? input.ports : defaultPorts;
    const byPort: Record<number, boolean> = {};

    // Try TCP connect to each port with short timeout
    await Promise.all(
      ports.map(async (port) => {
        byPort[port] = await this.tcpCheck(ip!, port, 1000);
      })
    );

    const online = Object.values(byPort).some(Boolean);
    const sourceDirExists = fs.existsSync(sourceDir);

    return {
      id,
      ip,
      online,
      ports: byPort,
      sourceDir,
      sourceDirExists,
      checkedAt: new Date().toISOString()
    };
  }

  private tcpCheck(host: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let done = false;

      const finalize = (result: boolean) => {
        if (done) return;
        done = true;
        try { socket.destroy(); } catch { /* noop */ }
        resolve(result);
      };

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finalize(true));
      socket.once('timeout', () => finalize(false));
      socket.once('error', () => finalize(false));
      // Some hosts may refuse connection quickly – still indicates reachability
      socket.once('close', (hadError) => finalize(!hadError));

      try {
        socket.connect(port, host);
      } catch {
        finalize(false);
      }
    });
  }
}

// Singleton default registry
export const managedServerRegistry = new ManagedServerRegistry();

