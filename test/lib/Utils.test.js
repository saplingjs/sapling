const test = require('ava');
const fs = require('fs');
const path = require('path');

const SaplingError = require('../../lib/SaplingError');

const Utils = require('../../lib/Utils');


test.before(t => {
	t.context.utils = new Utils();

	fs.chmodSync(path.join(__dirname, '../_data/inaccessible'), 0o100);
});


test('generates a random string', t => {
	const random = t.context.utils.randString();

	t.is(typeof random, 'string');
	t.is(random.length, 11);

	const random2 = t.context.utils.randString();

	t.not(random, random2);
});

test('gets all files in an existing directory', t => {
	const files = t.context.utils.getFiles(path.join(__dirname, '../_data/accessible'));

	t.true(Array.isArray(files));
	t.is(files.length, 2);
	t.true(files[0].endsWith('bar/foo.txt'));
	t.true(files[1].endsWith('file.txt'));
});

test('throws an error when getting files in a directory with no permissions', t => {
	t.throws(() => {
		t.context.utils.getFiles(path.join(__dirname, '../_data/inaccessible'));
	}, {instanceOf: SaplingError});
});

test('throws an error when getting files in non-existent directory', t => {
	t.throws(() => {
		t.context.utils.getFiles(path.join(__dirname, '../_data/nonexistent'));
	}, {instanceOf: SaplingError});
});

test('deep clones an object', t => {
	const original = { foo: "bar", baz: [ 1, 2, 3 ], bar: { qux: true, quux: false } };
	const clone = t.context.utils.deepClone(original);

	t.deepEqual(original, clone);
	t.not(original, clone);
});

test('converts values to true boolean', t => {
	t.true(t.context.utils.trueBoolean(true));
	t.true(t.context.utils.trueBoolean('true'));
	t.true(t.context.utils.trueBoolean('yes'));
	t.true(t.context.utils.trueBoolean('on'));
	t.true(t.context.utils.trueBoolean('TRUE'));
	t.true(t.context.utils.trueBoolean(1));
	t.true(t.context.utils.trueBoolean(() => true));
	t.true(t.context.utils.trueBoolean({ success: true }));
	t.true(t.context.utils.trueBoolean([1,2,3]));

	t.false(t.context.utils.trueBoolean(false));
	t.false(t.context.utils.trueBoolean('false'));
	t.false(t.context.utils.trueBoolean('no'));
	t.false(t.context.utils.trueBoolean('off'));
	t.false(t.context.utils.trueBoolean('FALSE'));
	t.false(t.context.utils.trueBoolean('something else'));
	t.false(t.context.utils.trueBoolean(0));
	t.false(t.context.utils.trueBoolean(() => false));
	t.false(t.context.utils.trueBoolean([]));
	t.false(t.context.utils.trueBoolean(Symbol("foobar")));

	t.falsy(t.context.utils.trueBoolean(undefined));
	t.falsy(t.context.utils.trueBoolean(null));
});


test.after(t => {
	fs.chmodSync(path.join(__dirname, '../_data/inaccessible'), 0o755);
});
