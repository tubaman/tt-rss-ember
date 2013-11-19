/* This is an abstraction around the weird tt-rss API
 * 
 * ex:
 * ttrss = TtRss();
 * ttrss.login('myuser', 'mypass');
 * categories = ttrss.getCategories();
 * feeds = ttrss.getFeeds(categories[0].id);
 * headlines = ttrss.getHeadlines(feeds[0].id);
 * */

function TtRss(url) {

	url = url || '/tt-rss/api/';

	var self = this,
		sid = null;
		sid = Ember.$.cookie('ttrss_api_sid');

	self.login = function(username, password) {
		return api({op: 'login', user: username, password: password})
			.done(function(data) {
				sid = data.content.session_id;
				return sid;
			});
	}

	self.getCategories = function() {
		return api({op: 'getCategories', enable_nested: 'false'})
			.done(function(data) {
				return data.content;
			});
	}

	self.getFeeds = function(catId) {
		return api({op: 'getFeeds', cat_id: catId, enable_nested: 'false'})
			.done(function(data) {
				return data.content;
			});
	}

	self.getHeadlines = function(feedId) {
		return api({op: 'getHeadlines', feed_id: feedId})
			.done(function(data) {
				return data.content;
			});
	}

	/* private functions */
	
	function api(data) {
		// If we're not logging in, include the session id
		if (data.op != 'login') {
			data.sid = sid;
		}
		return Ember.$.ajax({
			type: 'POST',
			url: url,
			contentType: 'application/json',
			dataType: 'json',
			data: JSON.stringify(data)
		})
		.then(function(data, textStatus, jqXHR) {
			if (data.content.error) {
				return Ember.$.Deferred().reject(jqXHR, data, data.content.error).promise();
			} else {
				return data;
			}
		});
	}

}
