const test = require('ava');
const _ = require('underscore');
const path = require('path');

const SaplingError = require('../../lib/SaplingError');

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

	t.is(Object.keys(t.context.app.structure).length, 1);
	t.false('dotfile' in t.context.app.structure);
});

test('throws error about a non-existant model path', async t => {
	t.plan(2);

	t.context.app.config.modelsDir = 'test/_data/models/nonexistant';
	const modelPath = path.join(t.context.app.dir, t.context.app.config.modelsDir);

	const error = await t.throwsAsync(async () => {
		await loadModel.call(t.context.app);
	}, {
		instanceOf: SaplingError
	});

	t.is(error.message, `Models directory \`${modelPath}\` does not exist`);
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
