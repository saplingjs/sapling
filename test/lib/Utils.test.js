import test from 'ava';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import SaplingError from '../../lib/SaplingError.js';

import Utils from '../../lib/Utils.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));


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

test('gets all files in an existing directory', async t => {
	const files = await t.context.utils.getFiles(path.join(__dirname, '../_data/accessible'));

	t.true(Array.isArray(files));
	t.is(files.length, 2);
	t.true(files[0].endsWith('bar/foo.txt'));
	t.true(files[1].endsWith('file.txt'));
});

test('throws an error when getting files in a directory with no permissions', async t => {
	await t.throwsAsync(async () => {
		await t.context.utils.getFiles(path.join(__dirname, '../_data/inaccessible'));
	}, {instanceOf: SaplingError});
});

test('throws an error when getting files in non-existent directory', async t => {
	await t.throwsAsync(async () => {
		await t.context.utils.getFiles(path.join(__dirname, '../_data/nonexistent'));
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

test('matches string against wildcard pattern', t => {
	t.true(t.context.utils.matchWildcard('string', 'str*'));
	t.true(t.context.utils.matchWildcard('string', '*ing'));
	t.true(t.context.utils.matchWildcard('string', '*tr*'));

	t.false(t.context.utils.matchWildcard('value', 'str*'));
	t.false(t.context.utils.matchWildcard('value', '*ing'));
	t.false(t.context.utils.matchWildcard('value', '*tr*'));

	t.true(t.context.utils.matchWildcard(5000, '5*'));
	t.false(t.context.utils.matchWildcard(6000, '5*'));

	/* Even when the pattern has some other regex-y characters */
	t.true(t.context.utils.matchWildcard('et tu, brute?', 'et tu, *?'));
	t.true(t.context.utils.matchWildcard('file.jpg', 'file.*'));
	t.false(t.context.utils.matchWildcard('files', 'file.*'));
});

test('coerces any value into an array', t => {
	t.deepEqual(t.context.utils.coerceArray('string'), ['string']);
	t.deepEqual(t.context.utils.coerceArray(1), [1]);
	t.deepEqual(t.context.utils.coerceArray(false), [false]);
	t.deepEqual(t.context.utils.coerceArray([1, 2, 3]), [1, 2, 3]);
});


test.after.always(t => {
	fs.chmodSync(path.join(__dirname, '../_data/inaccessible'), 0o755);
});
