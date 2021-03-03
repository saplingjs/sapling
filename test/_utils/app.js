const path = require('path');
const Utils = require('../../lib/Utils');

module.exports = () => {
	const app = {
		dir: path.join(__dirname, '../../'),
		config: {
			render: {
				driver: 'html'
			}
		},
		opts: {
			port: 3000
		},
		server: {
			use: () => true
		}
	};

	app.utils = new Utils(app);

	return app;
};
