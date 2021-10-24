import test from 'ava';

import SaplingError from '../../../lib/SaplingError.js';

import Interface from '../../../drivers/render/Interface.js';


test.before(t => {
	t.context.interface = new Interface();
})


test('render exists but not implemented', async t => {
	const error = await t.throwsAsync(async () => {
		return t.context.interface.render();
	}, { instanceOf: SaplingError });
	
	t.is(error.message, 'Method not implemented: render');
});

test('registerTags exists but not implemented', async t => {
	const error = await t.throwsAsync(async () => {
		return t.context.interface.registerTags();
	}, { instanceOf: SaplingError });
	
	t.is(error.message, 'Method not implemented: registerTags');
});
