import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { decryptTemplate, encryptTemplate } from '../src/crypto';
test('template encryption is randomized, authenticated, and bound to employee', () => {
  const key = randomBytes(32).toString('hex'), vector = Array.from({ length: 512 }, (_, i) => i / 512);
  const encrypted = encryptTemplate(vector, key, 'employee-one');
  assert.deepEqual(decryptTemplate(encrypted, key, 'employee-one'), vector);
  assert.notEqual(encrypted, encryptTemplate(vector, key, 'employee-one'));
  assert.throws(() => decryptTemplate(encrypted, key, 'employee-two'));
  assert.throws(() => decryptTemplate(encrypted, randomBytes(32).toString('hex'), 'employee-one'));
  const altered = Buffer.from(encrypted, 'base64'); altered[30] ^= 1;
  assert.throws(() => decryptTemplate(altered.toString('base64'), key, 'employee-one'));
});
