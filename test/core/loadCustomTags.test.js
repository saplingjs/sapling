import test from 'ava';
import _ from 'underscore';

import Request from '../../lib/Request.js';
import Storage from '../../lib/Storage.js';
import User from '../../lib/User.js';

import loadCustomTags from '../../core/loadCustomTags.js';


test.beforeEach(async t => {
	t.context.app = (await import('../_utils/app.js')).default();

	t.context.app.templating = {
		renderer: {
			registerTags: () => true
		}
	};

	t.context.app.user = new User(t.context.app);
	t.context.app.request = new Request(t.context.app);

	t.context.app.name = 'test';
	t.context.app.storage = new Storage(t.context.app);
	await t.context.app.storage.importDriver();
});


test('loads custom tags', async t => {
	t.plan(3);

	t.context.app.templating.renderer.registerTags = async (tags) => {
		t.true(_.isObject(tags));
		t.is(Object.keys(tags).length, 1);
		t.is(typeof tags.get, 'function');
	};

	await loadCustomTags.call(t.context.app);
});

test('calls callback when specified', async t => {
	await loadCustomTags.call(t.context.app, () => {
		t.pass();
	});
});

test('get tag fetches data', async t => {
	await t.context.app.storage.db.write('posts', { title: 'Hello' });
	await t.context.app.storage.db.write('posts', { title: 'Hi' });

	t.context.app.templating.renderer.registerTags = async (tags) => {
		const response = await tags.get.call(t.context.app, '/data/posts');
		t.is(response.length, 2);
	};

	await loadCustomTags.call(t.context.app);
});

test('get tag fetches data with given role', async t => {
	await t.context.app.storage.db.write('posts', { title: 'Hello' });
	await t.context.app.storage.db.write('posts', { title: 'Hi' });

	t.context.app.routeStack.get.push('/data/posts');
	t.context.app.permissions = {
		'get /data/posts': { role: 'admin' }
	};

	t.context.app.templating.renderer.registerTags = async (tags) => {
		const response = await tags.get.call(t.context.app, '/data/posts', 'admin');
		t.is(response.length, 2);
	};

	await loadCustomTags.call(t.context.app);
});

test('get tag fetches data with session role', async t => {
	await t.context.app.storage.db.write('posts', { title: 'Hello' });
	await t.context.app.storage.db.write('posts', { title: 'Hi' });

	t.context.app.data = {
		session: {
			user: {
				role: 'admin'
			}
		}
	};

	t.context.app.routeStack.get.push('/data/posts');
	t.context.app.permissions = {
		'get /data/posts': { role: 'admin' }
	};

	t.context.app.templating.renderer.registerTags = async (tags) => {
		const response = await tags.get.call(t.context.app, '/data/posts');
		t.is(response.length, 2);
	};

	await loadCustomTags.call(t.context.app);
});

test('get tag returns empty data with insufficient given role', async t => {
	await t.context.app.storage.db.write('posts', { title: 'Hello' });
	await t.context.app.storage.db.write('posts', { title: 'Hi' });

	t.context.app.routeStack.get.push('/data/posts');
	t.context.app.permissions = {
		'get /data/posts': { role: 'admin' }
	};

	t.context.app.templating.renderer.registerTags = async (tags) => {
		const response = await tags.get.call(t.context.app, '/data/posts', 'member');
		t.is(response.length, 0);
	};

	await loadCustomTags.call(t.context.app);
});

test('get tag returns empty data with insufficient session role', async t => {
	await t.context.app.storage.db.write('posts', { title: 'Hello' });
	await t.context.app.storage.db.write('posts', { title: 'Hi' });

	t.context.app.data = {
		session: {
			user: {
				role: 'member'
			}
		}
	};

	t.context.app.routeStack.get.push('/data/posts');
	t.context.app.permissions = {
		'get /data/posts': { role: 'admin' }
	};

	t.context.app.templating.renderer.registerTags = async (tags) => {
		const response = await tags.get.call(t.context.app, '/data/posts');
		t.is(response.length, 0);
	};

	await loadCustomTags.call(t.context.app);
});
