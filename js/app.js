window.App = Ember.Application.create();

// Fix for browser auto-fill and databinding
// http://stackoverflow.com/questions/22324473/browser-autofill-databinding
Ember.TextField.reopen({
  triggerEvents: function () {
    var thisTextField = this;
    Ember.run.next(function () {
      thisTextField.$().trigger("change");
    });
  }.on("didInsertElement")
});

App.Router.map(function() {
  this.resource('login', { path: '/login' });
  this.resource('categories', { path: '/' });
  this.resource('feeds', { path: '/category/:category_id' });
  this.resource('headlines', { path: '/feed/:feed_id' });
});

App.LoginRoute = Ember.Route.extend({
  setupController: function(controller, model) {
    controller.reset();
  }
});

App.AuthenticatedRoute = Ember.Route.extend({
  actions: {
    error: function(error, transition) {
      if (error == 'NOT_LOGGED_IN') {
        var loginController = this.controllerFor('login');
        loginController.set('attemptedTransition', transition);
        this.transitionTo('login');
      } 
    }
  }
});

App.CategoriesRoute = App.AuthenticatedRoute.extend({
  model: function() {
    return App.Categories;
  },

  afterModel: function(model, transition) {
    return App.Categories.fetch();
  }

});

App.FeedsRoute = App.AuthenticatedRoute.extend({

  model: function(params) {
    var category_id = parseInt(params.category_id);
    var category = App.Category.create({id: category_id});
    return category;
  },

  afterModel: function(category, transition) {
    return App.Feeds.fetch(category.get('id'));
  },
 
  setupController: function(controller, category) {
    category.set("feeds", App.Feeds);
    controller.set('model', category);
  }

});

App.HeadlinesRoute = App.AuthenticatedRoute.extend({

  model: function(params) {
    var feed_id = parseInt(params.feed_id);
    var feed = App.Feed.create({id: feed_id});
    return feed;
  },

  afterModel: function(feed, transition) {
    return App.Headlines.fetch(feed.get('id'));
  },

  setupController: function(controller, feed) {
    feed.set("headlines", App.Headlines);
    controller.set('model', feed);
  }
});

App.Scrolling = Em.Mixin.create({

  bindScrolling: function(opts) {
    var onScroll, _this = this;

    onScroll = function(){ 
        return _this.scrolled(); 
    };

    $(document).bind('touchmove', onScroll);
    $(window).bind('scroll', onScroll);
  },

  unbindScrolling: function() {
    $(window).unbind('scroll');
    $(document).unbind('touchmove');
  }

});

App.HeadlinesView = Ember.View.extend(App.Scrolling, {
  didInsertElement: function() {
    this.bindScrolling();
  },
  willRemoveElement: function() {
    this.unbindScrolling();
  },
  scrolled: function() {
    if ($(window).height() - $(window).scrollTop() < 1000) {
      this.get('controller').send('loadMore');
    }
  }
});

/* controllers */
App.LoginController = Ember.Controller.extend({
  reset: function() {
    this.setProperties({
      user: '',
      password: '',
      errorMessage: '',
    });
  },

  login: function() {
    var self = this;
    var ttrss = new TtRss();
    self.set('errorMessage', null);
    ttrss.login(this.get('user'), this.get('password')).then(
      function(sid) {
        self.set('sid', sid);
        var attemptedTransition = self.get('attemptedTransition');
        if (attemptedTransition) {
          attemptedTransition.retry()
          self.set('attemptedTransition', null);
        } else {
          self.transitionTo('categories');
        }
      },
      function(error) {
        self.set('errorMessage', "User and password combo don't match");
      });
  }
});

App.HeadlinesController = Ember.Controller.extend({
  isLoading: false,

  actions: {
    loadMore: function() {
      var self = this;
      if (self.get('isLoading') == false) {
        console.log("loading more")
        self.set('isLoading', true);
        return this.get('model').get('headlines').next().then(function() {
          self.set('isLoading', false);
        });
      }
    }
  }
});

/* models */
App.Category = Ember.Object.extend({});
App.Categories = Ember.ArrayProxy.create({
  content: [],

  fetch: function() {
    var self = this
    var content = self.get('content');
    var ttrss = new TtRss();
    if (App.Categories.get('length') != 0) {
      return self;
    }
    content.clear();
    return ttrss.getCategories().then(function(categories) {
      categories.forEach(function(data) {
        var category = App.Category.create();
        category.setProperties(data);
        category.set("feeds", []);
        content.pushObject(category);
      });
      return self;
    });
  }
});

App.Feed = Ember.Object.extend({});
App.Feeds = Ember.ArrayProxy.create({
  content: [],
  currentCategoryId: null,

  fetch: function(categoryId) {
    var self = this;
    var content = this.get('content');
    var ttrss = new TtRss();

    if (categoryId == self.get('currentCategoryId') && self.get('length') != 0)
    { 
      return self;
    }

    content.clear();
    return ttrss.getFeeds(categoryId).then(function(feeds) {
      feeds.forEach(function(data) {
        var feed = App.Feed.create();
        feed.setProperties(data);
        feed.set("headlines", []);
        content.pushObject(feed);
      });
      self.set('currentCategoryId', categoryId);
    });
  }
});

App.Headline = Ember.Object.extend({});
App.Headlines = Ember.ArrayProxy.create({
  content: [],
  currentFeedId: null,
  limit: 50,
  skip: 0,

  getHeadlines: function(feedId, limit, skip) {
    var self = this;
    var content = this.get('content');
    var ttrss = new TtRss();
    return ttrss.getHeadlines(feedId, limit, skip)
    .then(function(headlines) {
      headlines.forEach(function(data) {
        var headline = App.Headline.create();
        headline.setProperties(data);
        content.pushObject(headline);
      });
      self.set('currentFeedId', feedId);
      self.set('skip', skip + headlines.length);
    });
  },

  fetch: function(feedId) {
    var self = this;
    var content = this.get('content');

    if (feedId == self.get('currentFeedId') && self.get('length') != 0)
    {
      return self;
    }
    content.clear();
    self.set('skip', 0);

    return self.getHeadlines(feedId, self.get('limit'), self.get('skip'));
  },

  next: function() {
    return this.getHeadlines(
      this.get('currentFeedId'),
      this.get('limit'),
      this.get('skip')
    );
  }

});
