/**
 * Email Template Tests
 * Tests for email templating and rendering
 *
 * @module tests/email/email-templates.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Template engine
const createTemplateEngine = () => {
  const templates = new Map();
  const helpers = new Map();

  // Basic helpers
  helpers.set('uppercase', (str) => str?.toUpperCase() || '');
  helpers.set('lowercase', (str) => str?.toLowerCase() || '');
  helpers.set('date', (d) => new Date(d).toLocaleDateString());
  helpers.set('currency', (n, cur = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n)
  );

  return {
    register: (name, content, metadata = {}) => {
      templates.set(name, { content, metadata });
    },

    registerHelper: (name, fn) => {
      helpers.set(name, fn);
    },

    render: (name, data = {}) => {
      const template = templates.get(name);
      if (!template) throw new Error(`Template not found: ${name}`);

      let result = template.content;

      // Replace variables {{variable}}
      result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return data[key] ?? '';
      });

      // Replace helpers {{helper arg}}
      result = result.replace(/\{\{(\w+)\s+([^}]+)\}\}/g, (_, helperName, arg) => {
        const helper = helpers.get(helperName);
        if (!helper) return '';

        const argValue = arg.startsWith('"') ? arg.slice(1, -1) : (data[arg] ?? arg);

        return helper(argValue);
      });

      // Handle conditionals {{#if condition}}...{{/if}}
      result = result.replace(
        /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
        (_, condition, content) => {
          return data[condition] ? content : '';
        }
      );

      // Handle loops {{#each items}}...{{/each}}
      result = result.replace(
        /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
        (_, arrayName, content) => {
          const array = data[arrayName];
          if (!Array.isArray(array)) return '';

          return array
            .map((item) => {
              return content.replace(/\{\{this\.(\w+)\}\}/g, (_, key) => item[key] ?? '');
            })
            .join('');
        }
      );

      return result.trim();
    },

    getTemplate: (name) => templates.get(name),

    listTemplates: () => [...templates.keys()],
  };
};

// Email builder
const createEmailBuilder = (engine) => {
  return {
    build: (templateName, data, options = {}) => {
      const html = engine.render(templateName, data);
      const template = engine.getTemplate(templateName);

      return {
        subject: options.subject || template?.metadata.subject || '',
        html,
        text: options.text || html.replace(/<[^>]*>/g, ''),
        from: options.from || 'noreply@example.com',
        to: options.to || [],
        replyTo: options.replyTo,
      };
    },

    preview: (templateName, data) => {
      return engine.render(templateName, data);
    },
  };
};

// Email queue
const createEmailQueue = () => {
  const queue = [];
  const sent = [];

  return {
    enqueue: (email) => {
      const job = {
        id: crypto.randomUUID(),
        email,
        status: 'pending',
        createdAt: Date.now(),
      };
      queue.push(job);
      return job;
    },

    process: async (sender) => {
      while (queue.length > 0) {
        const job = queue.shift();
        try {
          await sender(job.email);
          job.status = 'sent';
          job.sentAt = Date.now();
        } catch (error) {
          job.status = 'failed';
          job.error = error.message;
        }
        sent.push(job);
      }
    },

    getPending: () => queue.length,

    getSent: () => [...sent],

    getByStatus: (status) => sent.filter((j) => j.status === status),
  };
};

describe('Template Engine Tests', () => {
  let engine;

  beforeEach(() => {
    engine = createTemplateEngine();
  });

  it('should render variables', () => {
    engine.register('welcome', 'Hello {{name}}!');

    const result = engine.render('welcome', { name: 'Alice' });

    expect(result).toBe('Hello Alice!');
  });

  it('should render helpers', () => {
    engine.register('shout', '{{uppercase name}}');

    const result = engine.render('shout', { name: 'hello' });

    expect(result).toBe('HELLO');
  });

  it('should handle conditionals', () => {
    engine.register('conditional', '{{#if premium}}Premium User{{/if}}');

    expect(engine.render('conditional', { premium: true })).toContain('Premium');
    expect(engine.render('conditional', { premium: false })).toBe('');
  });

  it('should handle loops', () => {
    engine.register('list', '{{#each items}}<li>{{this.name}}</li>{{/each}}');

    const result = engine.render('list', {
      items: [{ name: 'A' }, { name: 'B' }],
    });

    expect(result).toContain('<li>A</li>');
    expect(result).toContain('<li>B</li>');
  });

  it('should register custom helpers', () => {
    engine.registerHelper('reverse', (str) => str.split('').reverse().join(''));
    engine.register('test', '{{reverse text}}');

    const result = engine.render('test', { text: 'hello' });

    expect(result).toBe('olleh');
  });
});

describe('Email Builder Tests', () => {
  let engine;
  let builder;

  beforeEach(() => {
    engine = createTemplateEngine();
    engine.register('welcome', '<h1>Welcome {{name}}</h1>', { subject: 'Welcome!' });
    builder = createEmailBuilder(engine);
  });

  it('should build email', () => {
    const email = builder.build('welcome', { name: 'User' }, { to: ['user@test.com'] });

    expect(email.html).toContain('Welcome User');
    expect(email.subject).toBe('Welcome!');
    expect(email.to).toContain('user@test.com');
  });

  it('should generate text from HTML', () => {
    const email = builder.build('welcome', { name: 'User' });

    expect(email.text).toContain('Welcome User');
    expect(email.text).not.toContain('<h1>');
  });

  it('should preview template', () => {
    const preview = builder.preview('welcome', { name: 'Test' });

    expect(preview).toContain('Welcome Test');
  });
});

describe('Email Queue Tests', () => {
  let queue;

  beforeEach(() => {
    queue = createEmailQueue();
  });

  it('should enqueue email', () => {
    const job = queue.enqueue({ to: 'test@test.com', subject: 'Test' });

    expect(job.id).toBeTruthy();
    expect(queue.getPending()).toBe(1);
  });

  it('should process queue', async () => {
    const sender = vi.fn(async () => {});
    queue.enqueue({ to: 'a@test.com' });
    queue.enqueue({ to: 'b@test.com' });

    await queue.process(sender);

    expect(sender).toHaveBeenCalledTimes(2);
    expect(queue.getPending()).toBe(0);
  });

  it('should track sent emails', async () => {
    queue.enqueue({ to: 'test@test.com' });
    await queue.process(async () => {});

    const sent = queue.getSent();
    expect(sent).toHaveLength(1);
    expect(sent[0].status).toBe('sent');
  });

  it('should handle failures', async () => {
    const failingSender = vi.fn(async () => {
      throw new Error('SMTP error');
    });
    queue.enqueue({ to: 'test@test.com' });

    await queue.process(failingSender);

    const failed = queue.getByStatus('failed');
    expect(failed).toHaveLength(1);
  });
});
