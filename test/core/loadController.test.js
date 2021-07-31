import test from 'ava';
import path from 'path';
import _ from 'underscore';

import loadController from '../../core/loadController.js';


test.beforeEach(t => {
	t.context.app = _.defaults({
		dir: path.join(__dirname, '../_data')
	}, (await import('../_utils/app.js')).default());
});


test('generates a controller from a plain view directory', async t => {
	t.plan(1);

	t.context.app.config.autoRouting = true;
	t.context.app.config.extension = 'html';
	t.context.app.config.viewsDir = 'controller/plain';

	await loadController.call(t.context.app, () => {
		t.deepEqual(
			t.context.app.controller,
			{ '/': 'index', '/bar': 'bar', '/sub/foo': 'sub/foo', '/sub': 'sub/index' }
		);
	});
});

test('generates a controller from a view directory with protected files', async t => {
	t.plan(1);

	t.context.app.config.autoRouting = true;
	t.context.app.config.extension = 'html';
	t.context.app.config.viewsDir = 'controller/protectedFiles';

	await loadController.call(t.context.app, () => {
		t.deepEqual(
			t.context.app.controller,
			{ '/sub/foo': 'sub/foo' }
		);
	});
});

test('generates a controller from a view directory with protected folders', async t => {
	t.plan(1);

	t.context.app.config.autoRouting = true;
	t.context.app.config.extension = 'html';
	t.context.app.config.viewsDir = 'controller/protectedFolders';

	await loadController.call(t.context.app, () => {
		t.deepEqual(
			t.context.app.controller,
			{ '/bar': 'bar' }
		);
	});
});

test('does not generate a controller from an improper directory', async t => {
	t.plan(1);

	t.context.app.config.autoRouting = true;
	t.context.app.config.extension = 'html';
	t.context.app.config.viewsDir = 'controller/controller.json';

	await loadController.call(t.context.app, () => {
		t.deepEqual(
			t.context.app.controller,
			{}
		);
	});
});


test('loads a controller file correctly', t => {
	t.plan(1);

	t.context.app.config.autoRouting = false;
	t.context.app.config.routes = 'controller/controller.json';

	loadController.call(t.context.app, () => {
		t.deepEqual(
			t.context.app.controller,
			{ '/': 'index', '/my-account': 'my-account' }
		);
	});
});

test('logs an error if controller file is mangled', async t => {
	t.plan(2);

	process.env.NODE_ENV = 'production';
	console.log = () => true;

	t.context.app.config.autoRouting = false;
	t.context.app.config.routes = 'controller/mangled.json';

	console.error = (context, message) => {
		const controllerPath = path.join(t.context.app.dir, t.context.app.config.routes);
		t.is(message, `Controller at path: \`${controllerPath}\` could not be loaded.`);
	};

	await t.notThrowsAsync(async () => {
		return await loadController.call(t.context.app);
	});
});

test('fails silently if controller file does not exist', async t => {
	t.plan(1);

	t.context.app.config.autoRouting = false;
	t.context.app.config.routes = 'controller/nonexistent.json';

	console.error = () => {
		t.fail();
	};

	await t.notThrowsAsync(async () => {
		return await loadController.call(t.context.app);
	});
});

test('fails silently if controller file is a directory', async t => {
	t.plan(1);

	t.context.app.config.autoRouting = false;
	t.context.app.config.routes = 'controller/plain/';

	console.error = () => {
		t.fail();
	};

	await t.notThrowsAsync(async () => {
		return await loadController.call(t.context.app);
	});
});

test('fails silently if controller file is undefined', async t => {
	t.plan(1);

	t.context.app.config.autoRouting = false;

	console.error = () => {
		t.fail();
	};

	await t.notThrowsAsync(async () => {
		return await loadController.call(t.context.app);
	});
});


test('merges autorouted and explicit controllers correctly', async t => {
	t.plan(1);

	t.context.app.config.autoRouting = true;
	t.context.app.config.extension = 'html';
	t.context.app.config.viewsDir = 'controller/plain';
	t.context.app.config.routes = 'controller/controller.json';

	await loadController.call(t.context.app, () => {
		t.deepEqual(
			t.context.app.controller,
			{ '/': 'index', '/my-account': 'my-account', '/bar': 'bar', '/sub/foo': 'sub/foo', '/sub': 'sub/index' }
		);
	});
});


test.after.always(t => {
	process.env.NODE_ENV = 'test';
});
