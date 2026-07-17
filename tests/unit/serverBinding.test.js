import { describe, expect, test, afterEach, beforeEach } from '@jest/globals';
import { loadConfig } from '../../lib/config.js';
import net from 'net';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('Server network interface binding', () => {
  test('default binding (no CAMOFOX_NET_INTERFACE) should listen on all interfaces', () => {
    delete process.env.CAMOFOX_NET_INTERFACE;
    const config = loadConfig();
    expect(config.host).toBe('');
  });

  test('CAMOFOX_NET_INTERFACE=127.0.0.1 should configure loopback binding', () => {
    process.env.CAMOFOX_NET_INTERFACE = '127.0.0.1';
    const config = loadConfig();
    expect(config.host).toBe('127.0.0.1');
  });

  test('CAMOFOX_NET_INTERFACE=0.0.0.0 should configure all interfaces binding', () => {
    process.env.CAMOFOX_NET_INTERFACE = '0.0.0.0';
    const config = loadConfig();
    expect(config.host).toBe('0.0.0.0');
  });

  test('CAMOFOX_NET_INTERFACE with specific IP should be preserved', () => {
    process.env.CAMOFOX_NET_INTERFACE = '192.168.1.100';
    const config = loadConfig();
    expect(config.host).toBe('192.168.1.100');
  });

  // Integration test - verify actual socket binding behavior
  test('Express server binds to configured host', async () => {
    const testPort = 38456;
    const testHost = '127.0.0.1';
    
    // Create a simple Express app to test binding
    const { default: express } = await import('express');
    const app = express();
    app.get('/health', (req, res) => res.json({ ok: true }));
    
    // Start server with specific host
    const server = app.listen(testPort, testHost, () => {
      // Server started successfully
    });
    
    try {
      // Wait a bit for the server to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the server is listening on the correct address
      const address = server.address();
      if (!address) {
        throw new Error('Server failed to start - no address');
      }
      expect(address.port).toBe(testPort);
      expect(address.address).toBe(testHost);
      
      // Verify we can connect to it
      const response = await fetch(`http://${testHost}:${testPort}/health`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.ok).toBe(true);
      
    } finally {
      server.close();
    }
  }, 10000);

  test('Express server binds to all interfaces by default', async () => {
    const testPort = 38457;
    
    // Create a simple Express app to test default binding
    const { default: express } = await import('express');
    const app = express();
    app.get('/health', (req, res) => res.json({ ok: true }));
    
    // Start server without specific host (default behavior)
    const server = app.listen(testPort);
    
    try {
      // Verify the server is listening on all interfaces (IPv6 any address)
      const address = server.address();
      expect(address.port).toBe(testPort);
      // When no host is specified, Express listens on all interfaces
      // The address will be '::' for IPv6 or '0.0.0.0' for IPv4
      expect(['::', '0.0.0.0']).toContain(address.address);
      
      // Verify we can connect to it via localhost
      const response = await fetch(`http://localhost:${testPort}/health`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.ok).toBe(true);
      
    } finally {
      server.close();
    }
  }, 10000);
});
