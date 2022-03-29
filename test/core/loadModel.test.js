import test from 'ava';
import _ from 'underscore';
import path from 'path';

import SaplingError from '../../lib/SaplingError.js';

import loadModel from '../../core/loadModel.js';


test.before(t => {
	process.env.NODE_ENV = 'local';
	console.log = () => true;
});

test.beforeEach(async t => {
	t.context.app = _.defaults({
		config: { db: { driver: 'Memory' } }
	}, (await import('../_utils/app.js')).default());
});


test('loads string based model definition', async t => {
	t.context.app.config.modelsDir = 'test/_data/models/string';

	await t.notThrowsAsync(async () => {
		await loadModel.call(t.context.app);
	});

	t.true('posts' in t.context.app.storage.schema);
	t.true('title' in t.context.app.storage.schema.posts);
	t.true('viewCount' in t.context.app.storage.schema.posts);
	t.true(_.isObject(t.context.app.storage.schema.posts.title));
	t.true(_.isObject(t.context.app.storage.schema.posts.viewCount));
	t.is(t.context.app.storage.schema.posts.title.type, 'string');
	t.is(t.context.app.storage.schema.posts.viewCount.type, 'number');
});

test('loads object based model definition', async t => {
	t.context.app.config.modelsDir = 'test/_data/models/object';

	await t.notThrowsAsync(async () => {
		await loadModel.call(t.context.app);
	});

	t.true('posts' in t.context.app.storage.schema);
	t.true('title' in t.context.app.storage.schema.posts);
	t.true('viewCount' in t.context.app.storage.schema.posts);
	t.true(_.isObject(t.context.app.storage.schema.posts.title));
	t.true(_.isObject(t.context.app.storage.schema.posts.viewCount));
	t.is(t.context.app.storage.schema.posts.title.type, 'string');
	t.is(t.context.app.storage.schema.posts.title.required, true);
	t.is(t.context.app.storage.schema.posts.title.maxlen, 140);
	t.is(t.context.app.storage.schema.posts.viewCount.type, 'number');
	t.is(t.context.app.storage.schema.posts.viewCount.default, 0);
});

test('normalises access object', async t => {
	t.context.app.config.modelsDir = 'test/_data/models/access';

	await t.notThrowsAsync(async () => {
		await loadModel.call(t.context.app);
	});

	t.true('posts' in t.context.app.storage.schema);
	t.true('title' in t.context.app.storage.schema.posts);
	t.true('viewCount' in t.context.app.storage.schema.posts);
	t.true('content' in t.context.app.storage.schema.posts);
	t.true('access' in t.context.app.storage.schema.posts.title);
	t.true('access' in t.context.app.storage.schema.posts.viewCount);
	t.true('access' in t.context.app.storage.schema.posts.content);
	t.true(_.isObject(t.context.app.storage.schema.posts.title.access));
	t.true(_.isObject(t.context.app.storage.schema.posts.viewCount.access));
	t.true(_.isObject(t.context.app.storage.schema.posts.content.access));

	t.is(t.context.app.storage.schema.posts.title.access.r, 'anyone');
	t.is(t.context.app.storage.schema.posts.title.access.w, 'owner');
	t.is(t.context.app.storage.schema.posts.viewCount.access.r, 'anyone');
	t.is(t.context.app.storage.schema.posts.viewCount.access.w, 'anyone');
	t.is(t.context.app.storage.schema.posts.content.access.r, 'anyone');
	t.is(t.context.app.storage.schema.posts.content.access.w, 'anyone');
});

test('throws an error for a mangled model definition', async t => {
	t.context.app.config.modelsDir = 'test/_data/models/mangled';

	const error =await t.throwsAsync(async () => {
		await loadModel.call(t.context.app);
	}, {
		instanceOf: SaplingError
	});

	t.is(error.message, 'Error parsing model `posts`');
});

test('does not load dot files', async t => {
	t.context.app.config.modelsDir = 'test/_data/models/unrelated';

	await t.notThrowsAsync(async () => {
		await loadModel.call(t.context.app);
	});

	t.is(Object.keys(t.context.app.storage.schema).length, 1);
	t.false('dotfile' in t.context.app.storage.schema);
});

test('warns about a non-existant model path', async t => {
	t.plan(2);

	t.context.app.config.modelsDir = 'test/_data/models/nonexistant';

	console.warn = (workerId, message) => {
		const modelPath = path.join(t.context.app.dir, t.context.app.config.modelsDir);
		t.is(message, `Models directory \`${modelPath}\` does not exist`);
	}

	await t.notThrowsAsync(async () => {
		await loadModel.call(t.context.app);
	});
});

test('executes callback', async t => {
	t.plan(1);

	t.context.app.config.modelsDir = 'test/_data/models/string';

	return new Promise((resolve) => {
		loadModel.call(t.context.app, () => {
			t.pass();
			resolve();
		});
	});
});


test.after.always(t => {
	process.env.NODE_ENV = 'test';
});
