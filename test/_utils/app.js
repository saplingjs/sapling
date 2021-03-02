const path = require('path');

module.exports = {
	dir: path.join(__dirname, '../../'),
	config: {
		render: {
			driver: 'html'
		}
	},
	opts: {
		port: 3000
	}
};
