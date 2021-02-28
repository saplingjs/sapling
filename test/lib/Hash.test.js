const test = require('ava');

const Hash = require('../../lib/Hash');


test.before(t => {
	t.context.hash = new Hash();
});


test('hashes password correctly without salt', async t => {
	await t.notThrowsAsync(t.context.hash.hash('password'));

	const [ salt, hash ] = await t.context.hash.hash('password');

	t.is(salt.length, 172);
	t.is(hash.length, 172);
});

test('hashes password correctly with salt', async t => {
	await t.notThrowsAsync(t.context.hash.hash('password', 'NfN6Ogev9ggoM0B75LOkn+wDlQET7yLPZMzZAERYYWX9DaomFNjyzZ3U/8wLEgV07xRc5pez3v4RyP+9g6wdVE6putSas2t1bimPYf8FZbY+/lmzeneTIGtxhrmDUKxLactdUt6Nocaj3q66Hw8bEDp9/PI/dQQx1JDDGSrsYzI='));

	const hash = await t.context.hash.hash('password', 'NfN6Ogev9ggoM0B75LOkn+wDlQET7yLPZMzZAERYYWX9DaomFNjyzZ3U/8wLEgV07xRc5pez3v4RyP+9g6wdVE6putSas2t1bimPYf8FZbY+/lmzeneTIGtxhrmDUKxLactdUt6Nocaj3q66Hw8bEDp9/PI/dQQx1JDDGSrsYzI=');

	t.is(hash, 'AWjmoXFrqtCUw+dRNZ+gnQzdNSIYRkUjD0su66GKKeOH4F/OD0qPNvDoSWe8lJOqK5x0mWDzWHq/4gbGVvQEP0itDyEkihmuS9CuLovtxNCD0c+2CyHmUAlR2k/AIO8XYdLb/JZU5WUWHzG1bZY/7UTb1VeB3rVOItjOkI4EsLs=');
});


test('throws an error with an empty salt', async t => {
	const error = await t.throwsAsync(t.context.hash.hash('password', ''));
	t.is(error.message, 'Salt missing');
});

test('throws an error with an empty password', async t => {
	const error = await t.throwsAsync(t.context.hash.hash('', 'salt'));
	t.is(error.message, 'Password missing');
});

test('throws an error with no arguments', async t => {
	const error = await t.throwsAsync(t.context.hash.hash());
	t.is(error.message, 'Password missing');
});
