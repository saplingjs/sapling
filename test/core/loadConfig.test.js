import test from 'ava';
import path from 'path';
import { fileURLToPath } from 'url';

import SaplingError from '../../lib/SaplingError.js';

import loadConfig from '../../core/loadConfig.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));


test.beforeEach(async t => {
	t.context.app = (await import('../_utils/app.js')).default();
	process.env.NODE_ENV = 'test';
});


test.serial('loads the config', t => {
	loadConfig.call(t.context.app);

	t.is(t.context.app.config.name, 'untitled');
});

test.serial('uses default config when no config file is supplied', t => {
	t.context.app.configFile = 'test/_data/config/nonexistent.json';

	loadConfig.call(t.context.app, () => {
		t.is(t.context.app.config.name, 'untitled');
	});
});

test.serial('throws error when config file is mangled', async t => {
	t.context.app.configFile = 'test/_data/config/mangled.json';

	await t.throwsAsync(async () => {
		return await loadConfig.call(t.context.app);
	}, {
		instanceOf: SaplingError,
		message: 'Error loading config'
	});
});

test.serial('loads proper environment config when available', async t => {
	t.context.app.dir = path.join(__dirname, '../_data/config');
	process.env.NODE_ENV = 'production';
	console.log = () => true;

	loadConfig.call(t.context.app, () => {
		t.is(t.context.app.config.secret, 'default');
	});
});

test.serial('loads proper environment config with specified name when available', async t => {
	t.context.app.dir = path.join(__dirname, '../_data/config');
	t.context.app.configFile = 'custom.json';
	process.env.NODE_ENV = 'production';
	console.log = () => true;

	loadConfig.call(t.context.app, () => {
		t.is(t.context.app.config.secret, 'custom');
	});
});

test.serial('throws error when specified environment config file is mangled', async t => {
	t.context.app.dir = path.join(__dirname, '../_data/config');
	t.context.app.configFile = 'mangledProd.json';
	process.env.NODE_ENV = 'production';
	console.log = () => true;

	await t.throwsAsync(async () => {
		return await loadConfig.call(t.context.app);
	}, {
		instanceOf: SaplingError,
		message: 'Error loading production config'
	});
});


test.serial('strict off by default', t => {
	loadConfig.call(t.context.app, () => {
		t.falsy(t.context.app.config.strict);
	});
});

test.serial('strict on when set to true', t => {
	t.context.app.configFile = 'test/_data/config/strict.json';

	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.strict);
	});
});

test.serial('strict on when production set to true', t => {
	t.context.app.configFile = 'test/_data/config/production.json';

	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.strict);
	});
});


test.serial('production off by default', t => {
	loadConfig.call(t.context.app, () => {
		t.falsy(t.context.app.config.production);
	});
});

test.serial('production on when set to true', t => {
	t.context.app.configFile = 'test/_data/config/production.json';

	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.production);
	});
});


test.serial('showError on by default', t => {
	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.showError);
	});
});

test.serial('showError off when production set to true', t => {
	t.context.app.configFile = 'test/_data/config/production.json';

	loadConfig.call(t.context.app, () => {
		t.falsy(t.context.app.config.showError);
	});
});


test.serial('cors on by default', t => {
	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.cors);
	});
});

test.serial('cors off when set to false', t => {
	t.context.app.configFile = 'test/_data/config/cors.json';

	loadConfig.call(t.context.app, () => {
		t.falsy(t.context.app.config.cors);
	});
});

test.serial('cors off when production set to true', t => {
	t.context.app.configFile = 'test/_data/config/production.json';

	loadConfig.call(t.context.app, () => {
		t.falsy(t.context.app.config.cors);
	});
});

test.serial('cors on when set to true even if production set to true', t => {
	t.context.app.configFile = 'test/_data/config/corsProduction.json';

	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.cors);
	});
});


test.serial('compression off by default', t => {
	loadConfig.call(t.context.app, () => {
		t.falsy(t.context.app.config.compression);
	});
});

test.serial('compression on when set to true', t => {
	t.context.app.configFile = 'test/_data/config/compression.json';

	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.compression);
	});
});

test.serial('compression on when production set to true', t => {
	t.context.app.configFile = 'test/_data/config/production.json';

	loadConfig.call(t.context.app, () => {
		t.truthy(t.context.app.config.compression);
	});
});
