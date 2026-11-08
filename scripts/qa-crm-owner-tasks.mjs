import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../tests/fixtures/ux-v2.mjs';

const engine = process.env.LF_UX_BROWSER || 'chromium';
if (!['chromium', 'webkit'].includes(engine)) throw Error('Unsupported browser');
const browser = await ({ chromium, webkit })[engine].launch();
const root = path.resolve(import.meta.dirname, '../dist');
let scenarios = 0;

try {
  for (const width of [1280, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const calls = [];
    const readViews = [];
    let active = true;
    page.on('pageerror', error => calls.push('PAGE_ERROR: ' + error.message));

    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      assert.equal(url.origin, 'https://crm.test');
      if (url.pathname.startsWith('/api/')) {
        calls.push(url.pathname);
        const json = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
        if (url.pathname === '/api/crm/session') {
          return json(active ? 200 : 401, active ? {
            active: true, role: 'OWNER_ADMIN', actor_id: 'synthetic', workspace_enabled: false,
            price_list_enabled: false, report_summary_enabled: false, owner_tasks_enabled: true,
            expires_at: new Date(Date.now() + 180000).toISOString(), csrf_token: 'synthetic'
          } : { code: 'AUTH_REQUIRED' });
        }
        if (url.pathname === '/api/crm/read') {
          const body = route.request().postDataJSON();
          readViews.push(body.view);
          if (body.view === 'SESSION_ACTIVITY') return json(200, { read_only: true, expires_at: new Date(Date.now() + 180000).toISOString() });
          assert.deepEqual(body, { view: 'OWNER_CONTROL_CENTER' });
          return json(200, { dashboard: fixture() });
        }
        if (url.pathname === '/api/crm/logout') {
          active = false;
          return json(200, { logged_out: true });
        }
        throw Error('Unexpected API in read-only Control Center mode: ' + url.pathname);
      }
      const file = path.resolve(root, '.' + (url.pathname === '/crm' ? '/crm.html' : url.pathname));
      assert.ok(file.startsWith(root + '/'));
      try {
        return route.fulfill({ body: await fs.readFile(file), contentType: ({ '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css', '.woff': 'font/woff' })[path.extname(file)] || 'application/octet-stream' });
      } catch {
        return route.fulfill({ status: 404, body: '' });
      }
    });

    await page.goto('https://crm.test/crm');
    await expect(page.getByRole('heading', { name: 'Tvoj prehľad CRM', exact: true, level: 2 })).toBeVisible();
    await expect(page.locator('#crm-identity')).toHaveText('Majiteľka');
    await expect(page.locator('[data-view="tasks"]')).toBeVisible();
    await expect(page.locator('[data-view="reporting"]')).toBeHidden();
    await page.getByRole('button', { name: 'Otvoriť úlohy' }).click();
    await expect(page.getByRole('heading', { name: 'Úlohy', exact: true })).toBeVisible();
    const tabs = page.getByRole('navigation', { name: 'Podzáložky Úlohy' });
    await tabs.getByRole('button', { name: 'Úlohy', exact: true }).click();
    const table = page.getByRole('table', { name: 'Úlohy', exact: true });
    await expect(table.locator('tbody tr')).toHaveCount(7);
    await expect(table).toContainText('Synthetic t1');
    await expect(table).toContainText('IN_PROGRESS');
    await expect(table).toContainText('Other / Unclassified');
    assert.ok(readViews.includes('OWNER_CONTROL_CENTER'));
    assert.ok(calls.every(call => ['/api/crm/session', '/api/crm/read', '/api/crm/logout'].includes(call)));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await fs.mkdir('qa-artifacts/crm-owner-tasks', { recursive: true });
    await page.screenshot({ path: `qa-artifacts/crm-owner-tasks/${engine}-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Späť na prehľad' }).click();
    await expect(page.getByRole('heading', { name: 'Tvoj prehľad CRM', exact: true })).toBeVisible();
    await page.locator('#crm-logout').click();
    await expect(page.locator('#crm-login')).toBeVisible();
    await expect(page.locator('#crm-workspace')).toBeHidden();
    assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0]);
    scenarios++;
    await context.close();
  }
  console.log(JSON.stringify({ status: 'PASS', scenarios, owner_control_center_read_only: true, logout: true, storage: 'none' }));
} finally {
  await browser.close();
}
