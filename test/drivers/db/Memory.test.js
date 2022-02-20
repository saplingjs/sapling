import test from 'ava';

import SaplingError from '../../../lib/SaplingError.js';

import Memory from '../../../drivers/db/Memory.js';


test.before(t => {
	t.context.memory = new Memory();
});


test.serial('connect is stubbed', t => {
	t.true(t.context.memory.connect());
});

test.serial('creates a collection', t => {
	t.context.memory.createCollection('first');

	t.is(Object.keys(t.context.memory.memory).length, 1);
	t.true('first' in t.context.memory.memory);
	t.true(Array.isArray(t.context.memory.memory.first));
	t.is(t.context.memory.memory.first.length, 0);
});

test.serial('creates a second collection', t => {
	t.context.memory.createCollection('second');

	t.is(Object.keys(t.context.memory.memory).length, 2);
	t.true('second' in t.context.memory.memory);
	t.true(Array.isArray(t.context.memory.memory.second));
	t.is(t.context.memory.memory.second.length, 0);
});

test.serial('creates an index', t => {
	t.context.memory.createIndex('uniques', { email: 'unique' });

	t.deepEqual(t.context.memory.uniques, { uniques: [ 'email' ] });
});

test.serial('creates a new record in an existent collection', async t => {
	const results = await t.context.memory.write('first', { foo: 'bar', baz: 1 });

	t.true(Array.isArray(results));
	t.is(results.length, 1);
	t.is(results[0].foo, 'bar');
	t.is(results[0].baz, 1);
	t.true('_id' in results[0]);

	t.is(t.context.memory.memory.first.length, 1);
});

test.serial('creates a second new record in an existent collection', async t => {
	const results = await t.context.memory.write('first', { foo: 'qux', baz: 2 });

	t.true(Array.isArray(results));
	t.is(results.length, 1);
	t.is(results[0].foo, 'qux');
	t.is(results[0].baz, 2);
	t.true('_id' in results[0]);

	t.is(t.context.memory.memory.first.length, 2);
	t.not(t.context.memory.memory.first[0]._id, t.context.memory.memory.first[1]._id);
});

test.serial('creates a new record in a non-existent collection', async t => {
	const results = await t.context.memory.write('third', { foo: 'bar', baz: 1 });

	t.true(Array.isArray(results));
	t.is(results.length, 1);
	t.is(results[0].foo, 'bar');
	t.is(results[0].baz, 1);
	t.true('_id' in results[0]);

	t.is(Object.keys(t.context.memory.memory).length, 3);
	t.true('third' in t.context.memory.memory);
	t.true(Array.isArray(t.context.memory.memory.third));
	t.is(t.context.memory.memory.third.length, 1);
});

test.serial('throws an error attempting to create record with non-unique value for a unique field', async t => {
	await t.context.memory.write('uniques', { email: 'john@example.com' });

	await t.throwsAsync(async () => {
		return await t.context.memory.write('uniques', { email: 'john@example.com' });
	}, {
		instanceOf: SaplingError,
		message: 'Value of email must be unique'
	});
});

test.serial('reads all records in a collection', async t => {
	const results = await t.context.memory.read('first', {});

	t.true(Array.isArray(results));
	t.is(results.length, 2);
});

test.serial('reads a record by ID', async t => {
	const results = await t.context.memory.read('first', { _id: t.context.memory.memory.first[0]._id });

	t.true(Array.isArray(results));
	t.is(results.length, 1);
	t.is(results[0].foo, 'bar');
	t.is(results[0].baz, 1);
});

test.serial('reads a record by string value', async t => {
	const results = await t.context.memory.read('first', { foo: 'bar' });

	t.true(Array.isArray(results));
	t.is(results.length, 1);
	t.is(results[0].foo, 'bar');
	t.is(results[0].baz, 1);
});

test.serial('reads a record by numerical value', async t => {
	const results = await t.context.memory.read('first', { baz: 2 });

	t.true(Array.isArray(results));
	t.is(results.length, 1);
	t.is(results[0].foo, 'qux');
	t.is(results[0].baz, 2);
});

test.serial('reads records by array value', async t => {
	await t.context.memory.write('first', { foo: 'wax', baz: 10 });

	const results = await t.context.memory.read('first', { foo: ['bar', 'qux'] });

	t.true(Array.isArray(results));
	t.is(results.length, 2);
	t.is(results[0].foo, 'bar');
	t.is(results[1].foo, 'qux');
});

test.serial('reads a record by a preceding wildcard', async t => {
	await t.context.memory.write('fifth', { name: 'New Hampshire' });
	await t.context.memory.write('fifth', { name: 'New York' });
	await t.context.memory.write('fifth', { name: 'North Yorkshire' });
	await t.context.memory.write('fifth', { name: 'Hamptons' });
	await t.context.memory.write('fifth', { name: 'Mumbai' });

	const results = await t.context.memory.read('fifth', { name: '*shire' });

	t.true(Array.isArray(results));
	t.is(results.length, 2);
	t.is(results[0].name, 'New Hampshire');
	t.is(results[1].name, 'North Yorkshire');
});

test.serial('reads a record by a middle wildcard', async t => {
	const results = await t.context.memory.read('fifth', { name: 'n*shire' });

	t.true(Array.isArray(results));
	t.is(results.length, 2);
	t.is(results[0].name, 'New Hampshire');
	t.is(results[1].name, 'North Yorkshire');
});

test.serial('reads a record by a tailing wildcard', async t => {
	const results = await t.context.memory.read('fifth', { name: 'new*' });

	t.true(Array.isArray(results));
	t.is(results.length, 2);
	t.is(results[0].name, 'New Hampshire');
	t.is(results[1].name, 'New York');
});

test.serial('reads a record by multiple wildcards', async t => {
	const results = await t.context.memory.read('fifth', { name: '*amp*' });

	t.true(Array.isArray(results));
	t.is(results.length, 2);
	t.is(results[0].name, 'New Hampshire');
	t.is(results[1].name, 'Hamptons');
});

test.serial('reads records by array of wildcards', async t => {
	const results = await t.context.memory.read('fifth', { name: ['new*', '*york*'] });

	t.true(Array.isArray(results));
	t.is(results.length, 3);
	t.is(results[0].name, 'New Hampshire');
	t.is(results[1].name, 'New York');
	t.is(results[2].name, 'North Yorkshire');
});

test.serial('reads nothing in a non-existent collection', async t => {
	const results = await t.context.memory.read('fourth', {});

	t.true(Array.isArray(results));
	t.is(results.length, 0);
});

test.serial('modifies one record by ID', async t => {
	const results = await t.context.memory.modify('first', { _id: t.context.memory.memory.first[0]._id }, { new: 'hello' });

	t.true(Array.isArray(results));
	t.is(results.length, 1);
	t.is(results[0].foo, 'bar');
	t.is(results[0].baz, 1);
	t.is(results[0].new, 'hello');

	t.false('new' in t.context.memory.memory.first[1]);
});

test.serial('modifies records by string value', async t => {
	const results = await t.context.memory.modify('first', { foo: 'bar' }, { foo: 'quux' });

	t.true(Array.isArray(results));
	t.is(results.length, 1);
	t.is(results[0].foo, 'quux');
	t.is(results[0].baz, 1);
	t.is(results[0].new, 'hello');

	t.is(t.context.memory.memory.first[1].foo, 'qux');
	t.false('new' in t.context.memory.memory.first[1]);
});

test.serial('modifies records by numerical value', async t => {
	const results = await t.context.memory.modify('first', { baz: 2 }, { foo: 'qax' });

	t.true(Array.isArray(results));
	t.is(results.length, 1);
	t.is(results[0].foo, 'qax');
	t.is(results[0].baz, 2);

	t.is(t.context.memory.memory.first[0].foo, 'quux');
});

test.serial('modifies nothing in a non-existent collection', async t => {
	const results = await t.context.memory.modify('fourth', { baz: 2 }, { foo: 'qax' });

	t.true(Array.isArray(results));
	t.is(results.length, 0);
});

test.serial('throws an error attempting to modify record with non-unique value for a unique field', async t => {
	await t.context.memory.write('uniques', { email: 'sally@example.com' });

	await t.throwsAsync(async () => {
		return await t.context.memory.modify('uniques', { email: 'john@example.com' }, { email: 'sally@example.com' });
	}, {
		instanceOf: SaplingError,
		message: 'Value of email must be unique'
	});
});

test.serial('deletes one record by ID', async t => {
	await t.context.memory.write('first', { foo: 'baz', baz: 4 });
	await t.context.memory.write('first', { foo: 'boz', baz: 0 });
	await t.context.memory.write('first', { foo: 'bez', baz: 3 });

	t.is(t.context.memory.memory.first.length, 6);

	await t.context.memory.remove('first', { _id: t.context.memory.memory.first[0]._id });

	t.is(t.context.memory.memory.first.length, 5);
});

test.serial('deletes records by string value', async t => {
	t.is(t.context.memory.memory.first.length, 5);

	await t.context.memory.remove('first', { foo: 'baz' });

	t.is(t.context.memory.memory.first.length, 4);
});

test.serial('deletes records by numerical value', async t => {
	t.is(t.context.memory.memory.first.length, 4);

	await t.context.memory.remove('first', { baz: 3 });

	t.is(t.context.memory.memory.first.length, 3);
});

test.serial('deletes all records', async t => {
	t.is(t.context.memory.memory.first.length, 3);

	await t.context.memory.remove('first', {});

	t.is(t.context.memory.memory.first.length, 0);
});

test.serial('deletes nothing in a non-existent collection', async t => {
	const result = await t.context.memory.remove('fourth', {});

	t.true(result.data);
});
