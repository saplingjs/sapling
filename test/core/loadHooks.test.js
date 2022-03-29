import test from 'ava';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import SaplingError from '../../lib/SaplingError.js';
import parseMethodRouteKey from '../../core/parseMethodRouteKey.js';
import runHook from '../../core/runHook.js';

import loadHooks from '../../core/loadHooks.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));


test.before(t => {
	fs.chmodSync(path.join(__dirname, '../_data/hooks/inaccessible.json'), 0o100);
});

test.beforeEach(async t => {
	t.context.app = (await import('../_utils/app.js')).default();
	t.context.app.controller = {};
	t.context.app.config.hooks = 'test/_data/hooks/get.json';

	t.context.app.parseMethodRouteKey = parseMethodRouteKey;
	t.context.app.runHook = runHook;

	t.context.request = (await import('../_utils/request.js')).default();
	t.context.response = (await import('../_utils/response.js')).default();
});


test('loads hooks', async t => {
	t.context.app.config.hooks = 'test/_data/hooks/get.json';

	await t.notThrowsAsync(async () => {
		await loadHooks.call(t.context.app);
	});

	t.true('get /api/user/logged' in t.context.app.hooks);
});

test('does not create middleware for routes that are in the controller', async t => {
	t.context.app.config.hooks = 'test/_data/hooks/get.json';
	t.context.app.controller = {
		'/api/user/logged': 'logged'
	};

	t.context.app.server = {
		get: () => {
			t.fail('it should not create a middleware');
		}
	}

	await t.notThrowsAsync(async () => {
		await loadHooks.call(t.context.app);
	});

	t.true('get /api/user/logged' in t.context.app.hooks);
});

test('does create middleware for routes that are not in the controller', async t => {
	t.context.app.config.hooks = 'test/_data/hooks/get.json';
	t.context.app.controller = {
		'/api/user/foobar': 'quux'
	};

	t.context.app.server = {
		get: async (route, handler) => {
			t.is(route, '/api/user/logged');
		}
	}

	await t.notThrowsAsync(async () => {
		await loadHooks.call(t.context.app);
	});

	t.true('get /api/user/logged' in t.context.app.hooks);
});

test('fails silently with non-existent hooks file', async t => {
	t.context.app.config.hooks = 'test/_data/hooks/nonexistent.json';

	await t.notThrowsAsync(async () => {
		await loadHooks.call(t.context.app);
	});

	t.deepEqual(t.context.app.hooks, {});
});

test('throws error with inaccessible hooks file', async t => {
	t.context.app.config.hooks = 'test/_data/hooks/inaccessible.json';
	const hooksPath = path.join(t.context.app.dir, t.context.app.config.hooks);

	await t.throwsAsync(async () => {
		await loadHooks.call(t.context.app);
	}, {
		instanceOf: SaplingError,
		message: `Hooks at ${hooksPath} could not be read.`
	});
});

test('throws error with mangled hooks file', async t => {
	t.context.app.config.hooks = 'test/_data/hooks/mangled.json';
	const hooksPath = path.join(t.context.app.dir, t.context.app.config.hooks);

	await t.throwsAsync(async () => {
		await loadHooks.call(t.context.app);
	}, {
		instanceOf: SaplingError,
		message: `Hooks at ${hooksPath} could not be parsed.`
	});
});

test('executes callback', async t => {
	t.plan(1);

	return new Promise((resolve) => {
		loadHooks.call(t.context.app, () => {
			t.pass();
			resolve();
		});
	});
});


test.after.always(t => {
	fs.chmodSync(path.join(__dirname, '../_data/hooks/inaccessible.json'), 0o755);
});
