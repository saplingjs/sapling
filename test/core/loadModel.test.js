const test = require('ava');
const _ = require('underscore');
const path = require('path');

const loadModel = require('../../core/loadModel');


test.before(t => {
	process.env.NODE_ENV = 'local';
	console.log = () => true;
});

test.beforeEach(t => {
	t.context.app = _.defaults({
		config: { db: { driver: 'Memory' } }
	}, require('../_utils/app')());
});


test('loads string based model definition', async t => {
	t.context.app.config.modelsDir = 'test/_data/models/string';

	await t.notThrowsAsync(async () => {
		await loadModel.call(t.context.app);
	});

	t.true('posts' in t.context.app.structure);
	t.true('title' in t.context.app.structure.posts);
	t.true('viewCount' in t.context.app.structure.posts);
	t.true(_.isObject(t.context.app.structure.posts.title));
	t.true(_.isObject(t.context.app.structure.posts.viewCount));
	t.is(t.context.app.structure.posts.title.type, 'string');
	t.is(t.context.app.structure.posts.viewCount.type, 'number');
});

test('loads object based model definition', async t => {
	t.context.app.config.modelsDir = 'test/_data/models/object';

	await t.notThrowsAsync(async () => {
		await loadModel.call(t.context.app);
	});

	t.true('posts' in t.context.app.structure);
	t.true('title' in t.context.app.structure.posts);
	t.true('viewCount' in t.context.app.structure.posts);
	t.true(_.isObject(t.context.app.structure.posts.title));
	t.true(_.isObject(t.context.app.structure.posts.viewCount));
	t.is(t.context.app.structure.posts.title.type, 'string');
	t.is(t.context.app.structure.posts.title.required, true);
	t.is(t.context.app.structure.posts.title.maxlen, 140);
	t.is(t.context.app.structure.posts.viewCount.type, 'number');
	t.is(t.context.app.structure.posts.viewCount.default, 0);
});

test('throws an error for a mangled model definition', async t => {
	t.context.app.config.modelsDir = 'test/_data/models/mangled';

	await t.throwsAsync(async () => {
		await loadModel.call(t.context.app);
	});
});

test('does not load dot files', async t => {
	t.context.app.config.modelsDir = 'test/_data/models/unrelated';

	await t.notThrowsAsync(async () => {
		await loadModel.call(t.context.app);
	});

	t.is(Object.keys(t.context.app.structure).length, 1);
	t.false('dotfile' in t.context.app.structure);
});

test('warns about a non-existant model path', async t => {
	t.plan(2);

	t.context.app.config.modelsDir = 'test/_data/models/nonexistant';

	console.warn = (workerId, message) => {
		const modelPath = path.join(t.context.app.dir, t.context.app.config.modelsDir);
		t.is(message, `Models at path \`${modelPath}\` does not exist`);
	}

	await t.notThrowsAsync(async () => {
		await loadModel.call(t.context.app);
	});
});

test.cb('executes callback', t => {
	t.context.app.config.modelsDir = 'test/_data/models/string';

	loadModel.call(t.context.app, () => {
		t.pass();
		t.end();
	});
});


test.after.always(t => {
	process.env.NODE_ENV = 'test';
});
