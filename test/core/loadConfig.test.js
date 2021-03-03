const test = require('ava');

const loadConfig = require('../../core/loadConfig');


test.beforeEach(t => {
	t.context.app = require('../_utils/app')();
});


test('strict off by default', t => {
	loadConfig.call(t.context.app, () => {
		t.falsy(t.context.app.config.strict);
	});
});

test('strict on when set to true', t => {
	t.context.app.configFile = 'test/_data/config/strict.json';

	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.strict);
	});
});

test('strict on when production set to true', t => {
	t.context.app.configFile = 'test/_data/config/production.json';

	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.strict);
	});
});


test('production off by default', t => {
	loadConfig.call(t.context.app, () => {
		t.falsy(t.context.app.config.production);
	});
});

test('production on when set to true', t => {
	t.context.app.configFile = 'test/_data/config/production.json';

	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.production);
	});
});


test('showError on by default', t => {
	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.showError);
	});
});

test('showError off when production set to true', t => {
	t.context.app.configFile = 'test/_data/config/production.json';

	loadConfig.call(t.context.app, () => {
		t.falsy(t.context.app.config.showError);
	});
});


test('cors on by default', t => {
	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.cors);
	});
});

test('cors off when set to false', t => {
	t.context.app.configFile = 'test/_data/config/cors.json';

	loadConfig.call(t.context.app, () => {
		t.falsy(t.context.app.config.cors);
	});
});

test('cors off when production set to true', t => {
	t.context.app.configFile = 'test/_data/config/production.json';

	loadConfig.call(t.context.app, () => {
		t.falsy(t.context.app.config.cors);
	});
});

test('cors on when set to true even if production set to true', t => {
	t.context.app.configFile = 'test/_data/config/corsProduction.json';

	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.cors);
	});
});


test('compression off by default', t => {
	loadConfig.call(t.context.app, () => {
		t.falsy(t.context.app.config.compression);
	});
});

test('compression on when set to true', t => {
	t.context.app.configFile = 'test/_data/config/compression.json';

	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.compression);
	});
});

test('compression on when production set to true', t => {
	t.context.app.configFile = 'test/_data/config/production.json';

	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.compression);
	});
});
