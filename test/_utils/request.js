module.exports = () => {
	return {
		xhr: true,
		method: 'GET',
		url: '',
		originalUrl: '',
		query: {
			redirect: false
		},
		body: {},
		params: {},
		headers: {},
		session: {
			destroy: () => true
		},
		csrfToken: () => 'abc'
	};
};
