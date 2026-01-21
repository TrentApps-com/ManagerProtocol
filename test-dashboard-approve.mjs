import { chromium } from 'playwright';

async function testDashboard() {
  console.log('🎭 Starting Playwright dashboard test...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to dashboard
    console.log('📍 Navigating to http://localhost:8788...');
    await page.goto('http://localhost:8788', { waitUntil: 'networkidle' });

    // Wait for projects to load
    console.log('⏳ Waiting for projects to load...');
    await page.waitForSelector('.project-card', { timeout: 10000 });

    const projectCount = await page.locator('.project-card').count();
    console.log(`✅ Found ${projectCount} projects\n`);

    // Click on first project
    console.log('🖱️  Clicking on first project...');
    await page.locator('.project-card').first().click();

    // Wait for modal
    await page.waitForSelector('#projectModal.active', { timeout: 5000 });
    const modalTitle = await page.locator('#modalTitle').textContent();
    console.log(`✅ Modal opened: ${modalTitle}\n`);

    // Click Tasks tab
    console.log('🖱️  Clicking Tasks tab...');
    await page.locator('text=Tasks').click();
    await page.waitForTimeout(1000);

    const taskCount = await page.locator('.task-card').count();
    console.log(`✅ Found ${taskCount} tasks\n`);

    if (taskCount > 0) {
      // Click first task
      console.log('🖱️  Clicking on first task...');
      await page.locator('.task-card').first().click();
      await page.waitForTimeout(2000);

      // Check for task details
      const hasDescription = await page.locator('text=Description').count();
      const hasComments = await page.locator('text=Comments').count();

      console.log(`📝 Description section: ${hasDescription > 0 ? '✅ Present' : '❌ Missing'}`);
      console.log(`💬 Comments section: ${hasComments > 0 ? '✅ Present' : '❌ Missing'}\n`);

      // Check for approval buttons
      const approveBtn = await page.locator('button:has-text("Approve Task")').count();
      const denyBtn = await page.locator('button:has-text("Deny Task")').count();

      console.log(`🟢 Approve button: ${approveBtn > 0 ? '✅ Found' : '❌ Not found'}`);
      console.log(`🔴 Deny button: ${denyBtn > 0 ? '✅ Found' : '❌ Not found'}\n`);

      if (approveBtn > 0 && denyBtn > 0) {
        console.log('✨ SUCCESS: All approval UI elements are present!\n');

        // Take screenshot
        await page.screenshot({ path: '/tmp/dashboard-approval-ui.png', fullPage: true });
        console.log('📸 Screenshot saved to /tmp/dashboard-approval-ui.png\n');
      } else {
        console.log('⚠️  WARNING: Approval buttons not found!\n');
        await page.screenshot({ path: '/tmp/dashboard-no-buttons.png', fullPage: true });
        console.log('📸 Debug screenshot saved to /tmp/dashboard-no-buttons.png\n');
      }
    } else {
      console.log('⚠️  No tasks found to test\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: '/tmp/dashboard-error.png', fullPage: true });
    console.log('📸 Error screenshot saved to /tmp/dashboard-error.png\n');
  } finally {
    await browser.close();
    console.log('🎭 Test complete!');
  }
}

testDashboard();
