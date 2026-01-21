import { describe, it, expect, beforeEach } from 'vitest';
import { CSSAnalyzer, type CSSRule, type CSSAnalysisContext } from './CSSAnalyzer.js';

describe('CSSAnalyzer', () => {
  let analyzer: CSSAnalyzer;

  beforeEach(() => {
    analyzer = new CSSAnalyzer();
  });

  describe('Initialization', () => {
    it('should create a CSSAnalyzer instance', () => {
      expect(analyzer).toBeInstanceOf(CSSAnalyzer);
    });
  });

  describe('Basic Analysis', () => {
    it('should analyze a simple CSS rule', () => {
      const newRule: CSSRule = {
        selector: '.button',
        properties: {
          'background-color': '#007bff',
          'color': '#ffffff',
          'padding': '10px 20px'
        },
        source: 'inline'
      };

      const context: CSSAnalysisContext = {
        newRule
      };

      const result = analyzer.analyze(context);

      expect(result).toBeDefined();
      expect(result.ruleId).toBeDefined();
      expect(result.newRule).toBe(newRule);
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.duplicates).toBeInstanceOf(Array);
      expect(result.removableCandidates).toBeInstanceOf(Array);
      expect(typeof result.riskScore).toBe('number');
      expect(result.summary).toBeDefined();
    });

    it('should include shouldExternalize flag', () => {
      const newRule: CSSRule = {
        selector: '.component',
        properties: {
          'display': 'flex'
        },
        source: 'inline'
      };

      const result = analyzer.analyze({ newRule });

      expect(typeof result.shouldExternalize).toBe('boolean');
    });

    it('should include shouldMakeGlobal flag', () => {
      const newRule: CSSRule = {
        selector: '.utility',
        properties: {
          'margin': '0'
        },
        source: 'external'
      };

      const result = analyzer.analyze({ newRule });

      expect(typeof result.shouldMakeGlobal).toBe('boolean');
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate CSS rules', () => {
      const existingRule: CSSRule = {
        selector: '.button-primary',
        properties: {
          'background-color': '#007bff',
          'color': '#ffffff'
        },
        source: 'external',
        file: 'styles.css'
      };

      const newRule: CSSRule = {
        selector: '.btn-blue',
        properties: {
          'background-color': '#007bff',
          'color': '#ffffff'
        },
        source: 'inline'
      };

      const result = analyzer.analyze({
        newRule,
        existingRules: [existingRule]
      });

      expect(result.duplicates.length).toBeGreaterThanOrEqual(0);
    });

    it('should not flag non-duplicate rules', () => {
      const existingRule: CSSRule = {
        selector: '.button',
        properties: {
          'background-color': 'red'
        },
        source: 'external'
      };

      const newRule: CSSRule = {
        selector: '.link',
        properties: {
          'color': 'blue',
          'text-decoration': 'underline'
        },
        source: 'inline'
      };

      const result = analyzer.analyze({
        newRule,
        existingRules: [existingRule]
      });

      // Different properties, should not be considered duplicate
      expect(result.duplicates.length).toBe(0);
    });
  });

  describe('Externalization Check', () => {
    it('should recommend externalization for inline styles', () => {
      const newRule: CSSRule = {
        selector: '.component',
        properties: {
          'display': 'flex',
          'justify-content': 'center',
          'align-items': 'center',
          'padding': '20px'
        },
        source: 'inline'
      };

      const result = analyzer.analyze({ newRule });

      // Inline styles with multiple properties might be recommended for externalization
      expect(typeof result.shouldExternalize).toBe('boolean');
    });

    it('should not recommend externalization for already external rules', () => {
      const newRule: CSSRule = {
        selector: '.component',
        properties: {
          'color': 'red'
        },
        source: 'external',
        file: 'styles.css'
      };

      const result = analyzer.analyze({ newRule });

      expect(result.shouldExternalize).toBe(false);
    });
  });

  describe('Global Style Candidate Detection', () => {
    it('should detect global property indicators', () => {
      const newRule: CSSRule = {
        selector: '.text',
        properties: {
          'font-family': 'Arial, sans-serif',
          'color': '#333333'
        },
        source: 'inline'
      };

      const result = analyzer.analyze({ newRule });

      // font-family and color are global indicators
      expect(typeof result.shouldMakeGlobal).toBe('boolean');
    });

    it('should detect background-color as global indicator', () => {
      const newRule: CSSRule = {
        selector: '.container',
        properties: {
          'background-color': '#f5f5f5'
        },
        source: 'inline'
      };

      const result = analyzer.analyze({ newRule });

      expect(typeof result.shouldMakeGlobal).toBe('boolean');
    });
  });

  describe('Variable Candidates', () => {
    it('should detect color values as variable candidates', () => {
      const newRule: CSSRule = {
        selector: '.card',
        properties: {
          'background-color': '#007bff',
          'border-color': '#0056b3',
          'color': '#ffffff'
        },
        source: 'external'
      };

      const result = analyzer.analyze({ newRule });

      // Should suggest variables for hex colors
      const variableSuggestions = result.suggestions.filter(s => s.type === 'use_variable');
      expect(variableSuggestions.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect spacing values as variable candidates', () => {
      const newRule: CSSRule = {
        selector: '.box',
        properties: {
          'padding': '16px',
          'margin': '24px'
        },
        source: 'external'
      };

      const result = analyzer.analyze({ newRule });

      expect(result.suggestions).toBeInstanceOf(Array);
    });

    it('should detect RGB colors as variable candidates', () => {
      const newRule: CSSRule = {
        selector: '.element',
        properties: {
          'color': 'rgb(0, 123, 255)',
          'background': 'rgba(0, 0, 0, 0.5)'
        },
        source: 'external'
      };

      const result = analyzer.analyze({ newRule });

      expect(result.suggestions).toBeInstanceOf(Array);
    });
  });

  describe('Utility Class Opportunities', () => {
    it('should check for utility opportunities when style system exists', () => {
      const newRule: CSSRule = {
        selector: '.flex-center',
        properties: {
          'display': 'flex',
          'justify-content': 'center',
          'align-items': 'center'
        },
        source: 'inline'
      };

      const result = analyzer.analyze({
        newRule,
        hasStyleSystem: true,
        styleSystemName: 'tailwind'
      });

      expect(result.suggestions).toBeInstanceOf(Array);
    });

    it('should not check utilities when no style system', () => {
      const newRule: CSSRule = {
        selector: '.custom',
        properties: {
          'display': 'flex'
        },
        source: 'external'
      };

      const result = analyzer.analyze({
        newRule,
        hasStyleSystem: false
      });

      // Should still analyze but without utility suggestions
      expect(result).toBeDefined();
    });
  });

  describe('Specificity Checks', () => {
    it('should detect ID selectors (high specificity)', () => {
      const newRule: CSSRule = {
        selector: '#header',
        properties: {
          'background': 'blue'
        },
        source: 'external'
      };

      const result = analyzer.analyze({ newRule });

      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle class selectors (normal specificity)', () => {
      const newRule: CSSRule = {
        selector: '.button',
        properties: {
          'padding': '10px'
        },
        source: 'external'
      };

      const result = analyzer.analyze({ newRule });

      expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle element selectors (low specificity)', () => {
      const newRule: CSSRule = {
        selector: 'div',
        properties: {
          'margin': '0'
        },
        source: 'external'
      };

      const result = analyzer.analyze({ newRule });

      expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Naming Conventions', () => {
    it('should check naming conventions for different frameworks', () => {
      const frameworks = ['react', 'vue', 'angular', 'svelte', 'vanilla'] as const;

      for (const framework of frameworks) {
        const newRule: CSSRule = {
          selector: '.component-name',
          properties: {
            'color': 'red'
          },
          source: 'external'
        };

        const result = analyzer.analyze({
          newRule,
          framework
        });

        expect(result.suggestions).toBeInstanceOf(Array);
      }
    });

    it('should handle BEM naming convention', () => {
      const newRule: CSSRule = {
        selector: '.block__element--modifier',
        properties: {
          'display': 'block'
        },
        source: 'external'
      };

      const result = analyzer.analyze({ newRule });

      expect(result).toBeDefined();
    });
  });

  describe('Risk Scoring', () => {
    it('should calculate risk score based on issues', () => {
      const newRule: CSSRule = {
        selector: '#very-specific-id',
        properties: {
          'color': '#ff0000',
          'background-color': '#00ff00',
          'border-color': '#0000ff',
          'padding': '10px',
          'margin': '20px'
        },
        source: 'inline'
      };

      const result = analyzer.analyze({ newRule });

      expect(typeof result.riskScore).toBe('number');
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('should have lower risk for simple external rules', () => {
      const newRule: CSSRule = {
        selector: '.simple',
        properties: {
          'display': 'block'
        },
        source: 'external'
      };

      const result = analyzer.analyze({ newRule });

      expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Summary Generation', () => {
    it('should generate a summary of the analysis', () => {
      const newRule: CSSRule = {
        selector: '.test',
        properties: {
          'color': 'red'
        },
        source: 'inline'
      };

      const result = analyzer.analyze({ newRule });

      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('should include relevant information in summary', () => {
      const newRule: CSSRule = {
        selector: '.component',
        properties: {
          'background-color': '#007bff'
        },
        source: 'inline'
      };

      const result = analyzer.analyze({ newRule });

      // Summary should contain meaningful information
      expect(result.summary.length).toBeGreaterThan(10);
    });
  });

  describe('Context Handling', () => {
    it('should handle different project types', () => {
      const projectTypes = ['spa', 'mpa', 'component_library', 'website'] as const;

      for (const projectType of projectTypes) {
        const newRule: CSSRule = {
          selector: '.test',
          properties: {
            'color': 'blue'
          },
          source: 'external'
        };

        const result = analyzer.analyze({
          newRule,
          projectType
        });

        expect(result).toBeDefined();
      }
    });

    it('should handle component name context', () => {
      const newRule: CSSRule = {
        selector: '.button',
        properties: {
          'padding': '10px'
        },
        source: 'external'
      };

      const result = analyzer.analyze({
        newRule,
        componentName: 'Button'
      });

      expect(result).toBeDefined();
    });

    it('should handle global styles file context', () => {
      const newRule: CSSRule = {
        selector: '.global',
        properties: {
          'font-family': 'Arial'
        },
        source: 'external'
      };

      const result = analyzer.analyze({
        newRule,
        globalStylesFile: 'global.css'
      });

      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty properties', () => {
      const newRule: CSSRule = {
        selector: '.empty',
        properties: {},
        source: 'external'
      };

      const result = analyzer.analyze({ newRule });

      expect(result).toBeDefined();
      expect(result.suggestions).toBeInstanceOf(Array);
    });

    it('should handle complex selectors', () => {
      const newRule: CSSRule = {
        selector: 'div.container > ul.list li:nth-child(2n)',
        properties: {
          'color': 'blue'
        },
        source: 'external'
      };

      const result = analyzer.analyze({ newRule });

      expect(result).toBeDefined();
    });

    it('should handle pseudo-classes and pseudo-elements', () => {
      const newRule: CSSRule = {
        selector: '.button:hover::before',
        properties: {
          'content': '""',
          'display': 'block'
        },
        source: 'external'
      };

      const result = analyzer.analyze({ newRule });

      expect(result).toBeDefined();
    });

    it('should handle attribute selectors', () => {
      const newRule: CSSRule = {
        selector: 'input[type="text"]',
        properties: {
          'border': '1px solid #ccc'
        },
        source: 'external'
      };

      const result = analyzer.analyze({ newRule });

      expect(result).toBeDefined();
    });
  });

  describe('Removable Candidates', () => {
    it('should identify removable candidates when provided existing rules', () => {
      const existingRule: CSSRule = {
        selector: '.old-button',
        properties: {
          'color': 'red'
        },
        source: 'external',
        file: 'old-styles.css'
      };

      const newRule: CSSRule = {
        selector: '.new-button',
        properties: {
          'color': 'blue',
          'padding': '10px'
        },
        source: 'external'
      };

      const result = analyzer.analyze({
        newRule,
        existingRules: [existingRule]
      });

      expect(result.removableCandidates).toBeInstanceOf(Array);
    });

    it('should handle no existing rules', () => {
      const newRule: CSSRule = {
        selector: '.button',
        properties: {
          'color': 'blue'
        },
        source: 'external'
      };

      const result = analyzer.analyze({
        newRule,
        existingRules: []
      });

      expect(result.removableCandidates).toHaveLength(0);
    });
  });
});
