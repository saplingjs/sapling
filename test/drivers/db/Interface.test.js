const test = require('ava');

const SaplingError = require('../../../lib/SaplingError');

const Interface = require('../../../drivers/db/Interface');


test.before(t => {
	t.context.interface = new Interface();
})


test('connect exists but not implemented', async t => {
	const error = await t.throwsAsync(async () => {
		return t.context.interface.connect();
	}, { instanceOf: SaplingError });
	
	t.is(error.message, 'Method not implemented: connect');
});

test('createCollection exists but not implemented', async t => {
	const error = await t.throwsAsync(async () => {
		return t.context.interface.createCollection();
	}, { instanceOf: SaplingError });
	
	t.is(error.message, 'Method not implemented: createCollection');
});

test('createIndex exists but not implemented', async t => {
	const error = await t.throwsAsync(async () => {
		return t.context.interface.createIndex();
	}, { instanceOf: SaplingError });
	
	t.is(error.message, 'Method not implemented: createIndex');
});

test('read exists but not implemented', async t => {
	const error = await t.throwsAsync(async () => {
		return t.context.interface.read();
	}, { instanceOf: SaplingError });
	
	t.is(error.message, 'Method not implemented: read');
});

test('write exists but not implemented', async t => {
	const error = await t.throwsAsync(async () => {
		return t.context.interface.write();
	}, { instanceOf: SaplingError });
	
	t.is(error.message, 'Method not implemented: write');
});

test('modify exists but not implemented', async t => {
	const error = await t.throwsAsync(async () => {
		return t.context.interface.modify();
	}, { instanceOf: SaplingError });
	
	t.is(error.message, 'Method not implemented: modify');
});

test('remove exists but not implemented', async t => {
	const error = await t.throwsAsync(async () => {
		return t.context.interface.remove();
	}, { instanceOf: SaplingError });
	
	t.is(error.message, 'Method not implemented: remove');
});
