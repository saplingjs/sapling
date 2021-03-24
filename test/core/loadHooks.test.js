const test = require('ava');
const fs = require('fs');
const path = require('path');

const loadHooks = require('../../core/loadHooks');
const SaplingError = require('../../lib/SaplingError');


test.before(t => {
	fs.chmodSync(path.join(__dirname, '../_data/hooks/inaccessible.json'), 0o100);
});

test.beforeEach(t => {
	t.context.app = require('../_utils/app')();
	t.context.app.controller = {};
	t.context.app.config.hooks = 'test/_data/hooks/get.json';

	t.context.app.parseMethodRouteKey = require('../../core/parseMethodRouteKey');
	t.context.app.runHook = require('../../core/runHook');

	t.context.request = require('../_utils/request')();
	t.context.response = require('../_utils/response')();
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

test.cb('executes callback', t => {
	loadHooks.call(t.context.app, () => {
		t.pass();
		t.end();
	});
});


test.after.always(t => {
	fs.chmodSync(path.join(__dirname, '../_data/hooks/inaccessible.json'), 0o755);
});
