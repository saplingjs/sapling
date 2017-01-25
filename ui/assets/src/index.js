var p = null;

$(document).ready(function () {
	if (window.location.hash) {
		var hash = window.location.hash.substr(1);
		$("#page").empty();

		switch (hash) {
			case "page":
				p = new PageController({superview: "page"});
			break;

			case "config":
				p = new ConfigController({superview: "page"});
			break;

			case "model":
				p = new ModelController({superview: "page"});
			break;

			case "permissions":
				p = new PermissionController({superview: "page"});
			break;

			case "route":
				p = new RouteController({superview: "page"});
			break;

			case "template":
				p = new TemplateController({superview: "page"});
			break;
		}
	}	
})
