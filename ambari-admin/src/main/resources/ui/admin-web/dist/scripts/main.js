/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole', [
  'ngRoute',
  'ngAnimate',
  'ui.bootstrap',
  'restangular',
  'toggle-switch',
  'pascalprecht.translate'
])
.constant('Settings', {
  siteRoot: '{proxy_root}/'.replace(/\{.+\}/g, ''),
	baseUrl: '{proxy_root}/api/v1'.replace(/\{.+\}/g, ''),
  testMode: false,
  mockDataPrefix: 'assets/data/',
  isLDAPConfigurationSupported: false,
  isLoginActivitiesSupported: false,
  maxStackTraceLength: 1000,
  errorStorageSize: 500000,
  minRowsToShowPagination: 10
})
.config(['RestangularProvider', '$httpProvider', '$provide', 'Settings', function(RestangularProvider, $httpProvider, $provide, Settings) {
  // Config Ajax-module
  RestangularProvider.setBaseUrl(Settings.baseUrl);
  RestangularProvider.setDefaultHeaders({'X-Requested-By':'ambari'});

  $httpProvider.defaults.headers.post['Content-Type'] = 'plain/text';
  $httpProvider.defaults.headers.put['Content-Type'] = 'plain/text';

  $httpProvider.defaults.headers.post['X-Requested-By'] = 'ambari';
  $httpProvider.defaults.headers.put['X-Requested-By'] = 'ambari';
  $httpProvider.defaults.headers.common['X-Requested-By'] = 'ambari';

  $httpProvider.interceptors.push(['Settings', '$q', function(Settings, $q) {
    return {
      'request': function(config) {
        if (Settings.testMode) {
          if (config.method === 'GET') {
            config.url = (config.mock) ? Settings.mockDataPrefix + config.mock : config.url;
          } else {
            config.method = "GET";
          }
        }
        return config;
      }
    };
  }]);

  $httpProvider.interceptors.push(['$rootScope', '$q', function (scope, $q) {
    function success(response) {
      return response;
    }

    function error(response) {
      if (response.status == 403) {
        window.location = Settings.siteRoot;
        return;
      }
      return $q.reject(response);
    }

    return function (promise) {
      return promise.then(success, error);
    }
  }]);

  $provide.factory('TimestampHttpInterceptor', [function($q) {
    return {
      request: function(config) {
        if (config && config.method === 'GET' && config.url.indexOf('html') === -1) {
          config.url += config.url.indexOf('?') < 0 ? '?' : '&';
          config.url += '_=' + new Date().getTime();
         }
         return config || $q.when(config);
      }
   };
  }]);
  $httpProvider.interceptors.push('TimestampHttpInterceptor');

  $provide.decorator('ngFormDirective', ['$delegate', function($delegate) {
    var ngForm = $delegate[0], controller = ngForm.controller;
    ngForm.controller = ['$scope', '$element', '$attrs', '$injector', function(scope, element, attrs, $injector) {
    var $interpolate = $injector.get('$interpolate');
      attrs.$set('name', $interpolate(attrs.name || '')(scope));
      $injector.invoke(controller, this, {
        '$scope': scope,
        '$element': element,
        '$attrs': attrs
      });
    }];
    return $delegate;
  }]);

  $provide.decorator('ngModelDirective', ['$delegate', function($delegate) {
    var ngModel = $delegate[0], controller = ngModel.controller;
    ngModel.controller = ['$scope', '$element', '$attrs', '$injector', function(scope, element, attrs, $injector) {
      var $interpolate = $injector.get('$interpolate');
      attrs.$set('name', $interpolate(attrs.name || '')(scope));
      $injector.invoke(controller, Object.setPrototypeOf(this, controller.prototype), {
        '$scope': scope,
        '$element': element,
        '$attrs': attrs
      });
    }];
    return $delegate;
  }]);

  $provide.decorator('formDirective', ['$delegate', function($delegate) {
    var form = $delegate[0], controller = form.controller;
    form.controller = ['$scope', '$element', '$attrs', '$injector', function(scope, element, attrs, $injector) {
      var $interpolate = $injector.get('$interpolate');
      attrs.$set('name', $interpolate(attrs.name || attrs.ngForm || '')(scope));
        $injector.invoke(controller, Object.setPrototypeOf(this, controller.prototype), {
        '$scope': scope,
        '$element': element,
        '$attrs': attrs
      });
    }];
    return $delegate;
  }]);

  $provide.decorator('$exceptionHandler', ['$delegate', 'Utility', '$window', function ($delegate, Utility, $window) {
    return function (error, cause) {
      var ls = JSON.parse($window.localStorage.getItem('errors')) || {},
        key = new Date().getTime(),
        origin = $window.location.origin || ($window.location.protocol + '//' + $window.location.host),
        pattern = new RegExp(origin + '/.*scripts', 'g'),
        stackTrace = error && error.stack && error.stack.replace(pattern, '').substr(0, Settings.maxStackTraceLength),
        file = error && error.fileName,
        line = error && error.lineNumber,
        col = error && error.columnNumber;

      if (error && error.stack && (!file || !line || !col)) {
        var patternText = '(' + $window.location.protocol + '//.*\\.js):(\\d+):(\\d+)',
          details = error.stack.match(new RegExp(patternText));
        file = file || (details && details [1]);
        line = line || (details && Number(details [2]));
        col = col || (details && Number(details [3]));
      }

      var val = {
        file: file,
        line: line,
        col: col,
        error: error.toString(),
        stackTrace: stackTrace
      };

      //overwrite errors if storage full
      if (JSON.stringify(ls).length > Settings.errorStorageSize) {
        delete ls[Object.keys(ls).sort()[0]];
      }

      ls[key] = val;
      var lsString = JSON.stringify(ls);
      $window.localStorage.setItem('errors', lsString);
      Utility.postUserPref('errors', ls);
      $delegate(error, cause);
    };
  }]);

  if (!Array.prototype.find) {
    Array.prototype.find = function (callback, context) {
      if (this == null) {
        throw new TypeError('Array.prototype.find called on null or undefined');
      }
      if (typeof callback !== 'function') {
        throw new TypeError(callback + ' is not a function');
      }
      var list = Object(this),
        length = list.length >>> 0,
        value;
      for (var i = 0; i < length; i++) {
        value = list[i];
        if (callback.call(context, value, i, list)) {
          return value;
        }
      }
      return undefined;
    };
  }
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.constant('ROUTES', {
  authentication: {
    main: {
      url: '/authentication',
      templateUrl: 'views/authentication/main.html',
      controller: 'AuthenticationMainCtrl'
    }
  },
  loginActivities: {
    loginMessage: {
      url: '/loginMessage',
      templateUrl: 'views/loginActivities/main.html',
      controller: 'LoginActivitiesMainCtrl'
    },
    homeDirectory: {
      url: '/homeDirectory',
      templateUrl: 'views/loginActivities/main.html',
      controller: 'LoginActivitiesMainCtrl'
    }
  },
  userManagement: {
    main: {
      url: '/userManagement',
      templateUrl: 'views/userManagement/main.html',
      controller: 'UserManagementCtrl',
      label: 'Users'
    },
    editUser: {
      url: '/users/:id/edit',
      templateUrl: 'views/userManagement/userEdit.html',
      controller: 'UserEditCtrl',
      label: 'Users'
    },
    editGroup: {
      url: '/groups/:id/edit',
      templateUrl: 'views/userManagement/groupEdit.html',
      controller: 'GroupEditCtrl',
      label: 'Groups'
    },
  },
  views: {
    list: {
      url: '/views',
      templateUrl: 'views/ambariViews/viewsList.html',
      controller: 'ViewsListCtrl',
      label: 'Views'
    },
    edit: {
      url: '/views/:viewId/versions/:version/instances/:instanceId/edit',
      templateUrl: 'views/ambariViews/edit.html',
      controller: 'ViewsEditCtrl',
      label: 'Views'
    },
    createViewUrl: {
      url: '/urls/new',
      templateUrl: 'views/urls/create.html',
      controller: 'ViewUrlCtrl',
      label: 'Views'
    },
    linkViewUrl: {
      url: '/urls/link/:viewName/:viewVersion/:viewInstanceName',
      templateUrl: 'views/urls/create.html',
      controller: 'ViewUrlCtrl',
      label: 'Views'
    },
    editViewUrl: {
      url: '/urls/edit/:urlName',
      templateUrl: 'views/urls/edit.html',
      controller: 'ViewUrlEditCtrl',
      label: 'Views'
    }
  },
  stackVersions: {
    list: {
      url: '/stackVersions',
      templateUrl: 'views/stackVersions/list.html',
      controller: 'StackVersionsListCtrl',
      label: 'Versions'
    },
    create: {
      url: '/stackVersions/create',
      templateUrl: 'views/stackVersions/stackVersionPage.html',
      controller: 'StackVersionsCreateCtrl',
      label: 'Versions'
    },
    edit: {
      url: '/stackVersions/:stackName/:versionId/edit',
      templateUrl: 'views/stackVersions/stackVersionPage.html',
      controller: 'StackVersionsEditCtrl',
      label: 'Versions'
    }
  },
  remoteClusters: {
    list: {
      url: '/remoteClusters',
      templateUrl: 'views/remoteClusters/list.html',
      controller: 'RemoteClustersListCtrl',
      label: 'Remote Clusters'
    },
    create: {
      url: '/remoteClusters/create',
      templateUrl: 'views/remoteClusters/remoteClusterPage.html',
      controller: 'RemoteClustersCreateCtrl',
      label: 'Remote Clusters'
    },
    edit: {
      url: '/remoteClusters/:clusterName/edit',
      templateUrl: 'views/remoteClusters/editRemoteClusterPage.html',
      controller: 'RemoteClustersEditCtrl',
      label: 'Remote Clusters'
    }
  },
  clusters: {
    clusterInformation: {
      url: '/clusterInformation',
      templateUrl: 'views/clusters/clusterInformation.html',
      controller: 'ClusterInformationCtrl',
      label: 'Cluster Information'
    }
  },
  dashboard: {
    url: '/dashboard',
    controller: ['$window', function ($window) {
      $window.location.replace('/#/main/dashboard');
    }],
    template: ''
  }
})
.config(['$routeProvider', '$locationProvider', 'ROUTES', function ($routeProvider, $locationProvider, ROUTES) {
  $locationProvider.hashPrefix('');
  var createRoute = function (routeObj) {
    if (routeObj.url) {
      $routeProvider.when(routeObj.url, routeObj);
    } else {
      angular.forEach(routeObj, createRoute);
    }
  };
  var rootUrl = ROUTES['clusters']['clusterInformation'].url;
  angular.forEach(ROUTES, createRoute);
  $routeProvider.otherwise({
    redirectTo: rootUrl
  });
}])
.run(['$rootScope', 'ROUTES', 'Settings', function ($rootScope, ROUTES, Settings) {
  // Make routes available in every template and controller
  $rootScope.ROUTES = ROUTES;
  $rootScope.$on('$locationChangeStart', function (e, nextUrl) {
    if (/\/authentication$/.test(nextUrl) && !Settings.isLDAPConfigurationSupported) {
      e.preventDefault();
    }
  });
  $rootScope.$on('$locationChangeStart', function (e, nextUrl) {
    if ((/\/loginMessage$/.test(nextUrl) || /\/homeDirectory$/.test(nextUrl)) && !Settings.isLoginActivitiesSupported) {
      e.preventDefault();
    }
  });

  /**
   * Method using to generate full URI from site root, this method should be used
   * along with all 'href' attribute or methods which invoke redirect to Ambari Web.
   * This method is useful to determine actual site root when ambari run under proxy server.
   *
   * @param {string} url
   * @returns {string}
   */
  $rootScope.fromSiteRoot = function (url) {
    var path = url[0] === '/' ? url.substring(1) : url;
    return Settings.siteRoot + path;
  };
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.config(['$translateProvider', function($translateProvider) {
  $translateProvider.translations('en',{
    'CLUSTER.ADMINISTRATOR': 'Operator',
    'CLUSTER.USER': 'Read-Only',
    'VIEW.USER': 'Use',

    'common.ambari': 'Ambari',
    'common.apacheAmbari': 'Apache Ambari',
    'common.about': 'About',
    'common.version': 'Version',
    'common.signOut': 'Sign out',
    'common.register': 'Register',
    'common.clusters': 'Clusters',
    'common.views': 'Views',
    'common.roles': 'Roles',
    'common.users': 'Users',
    'common.groups': 'Groups',
    'common.versions': 'Versions',
    'common.stack': 'Stack',
    'common.details': 'Details',
    'common.dashboard': 'Dashboard',
    'common.goToDashboard': 'Go to Dashboard',
    'common.exportBlueprint': 'Export Blueprint',
    'common.download': 'Download',
    'common.noClusters': 'No Clusters',
    'common.noViews': 'No Views',
    'common.view': 'View',
    'common.displayLabel': 'Display label',
    'common.search': 'Search',
    'common.name': 'Name',
    'common.any': 'Any',
    'common.none': 'None',
    'common.type': 'Type',
    'common.add': 'Add {{term}}',
    'common.delete': 'Delete {{term}}',
    'common.deregisterCluster': 'Deregister Cluster',
    'common.cannotDelete': 'Cannot Delete {{term}}',
    'common.privileges': 'Privileges',
    'common.cluster': 'Cluster',
    'common.remoteClusters': 'Remote Clusters',
    'common.services': 'Services',
    'common.clusterRole': 'Cluster Role',
    'common.viewPermissions': 'View Permissions',
    'common.getInvolved': 'Get involved!',
    'common.license': 'Licensed under the Apache License, Version 2.0',
    'common.tableFilterMessage': '{{showed}} of {{total}} {{term}} showing',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.renameCluster': 'Rename Cluster',
    'common.renameClusterTip': 'Only alpha-numeric characters, up to 80 characters',
    'common.clusterCreationInProgress': 'Cluster creation in progress...',
    'common.all': 'All',
    'common.group': 'Group',
    'common.user': 'User',
    'common.settings': 'Settings',
    'common.authentication': 'Authentication',
    'common.deleteConfirmation': 'Are you sure you want to delete {{instanceType}} {{instanceName}}?',
    'common.remoteClusterDelConfirmation': 'Are you sure you want to delete {{instanceType}} {{instanceName}}? This operation cannot be undone.',
    'common.messageInstanceAffected': 'The following View Instances are using this Remote Cluster for configuration, and will need to be reconfigured:',
    'common.local': 'Local',
    'common.remote': 'Remote',
    'common.pam': 'PAM',
    'common.ldap': 'LDAP',
    'common.jwt': 'JWT',
    'common.warning': 'Warning',
    'common.filterInfo': '{{showed}} of {{total}} {{term}} showing',
    'common.usersGroups': 'Users/Groups',
    'common.enabled': 'Enabled',
    'common.disabled': 'Disabled',
    'common.NA': 'n/a',
    'common.blockViewLabel': 'BLOCK',
    'common.listViewLabel': 'LIST',
    'common.rbac': 'Role Based Access Control',
    'common.important': 'Important',
    'common.undo': 'Undo',
    'common.fromGroupMark': '(from group)',
    'common.copy': '_Copy',
    'common.clusterInformation': 'Cluster Information',
    'common.clusterManagement': 'Cluster Management',
    'common.userManagement': 'User Management',
    'common.admin': 'Admin',
    'common.actions': 'Actions',
    'common.error': 'Error',
    'common.select': 'Select',

    'common.clusterNameChangeConfirmation.title': 'Confirm Cluster Name Change',
    'common.clusterNameChangeConfirmation.message': 'Are you sure you want to change the cluster name to {{clusterName}}?',

    'common.loginActivities.loginActivities': 'Login Activities',
    'common.loginActivities.loginMessage': 'Login Message',
    'common.loginActivities.loginMessage.placeholder': 'Please enter login message',
    'common.loginActivities.homeDirectory': 'Home Directory',
    'common.loginActivities.notEmpty': 'These field cannot be empty',
    'common.loginActivities.saveError': 'Save error',
    'common.loginActivities.message': 'Message',

    'common.loginActivities.buttonText': 'Button',
    'common.loginActivities.buttonText.placeholder': 'Please enter button text',

    'common.loginActivities.status': 'Status',
    'common.loginActivities.status.disabled': 'Disabled',

    'common.loginActivities.homeDirectory.alert': 'Many Ambari Views store user preferences in the logged in user\'s / user directory in HDFS. Optionally, Ambari can auto-create these directories for users on login.',
    'common.loginActivities.homeDirectory.autoCreate': 'Auto-Create HDFS user directories',
    'common.loginActivities.homeDirectory.header': 'User Directory Creation Options',
    'common.loginActivities.homeDirectory.template': 'User Directory creation template',
    'common.loginActivities.homeDirectory.group': 'Default Group',
    'common.loginActivities.homeDirectory.permissions': 'Permissions',

    'common.controls.cancel': 'Cancel',
    'common.controls.close': 'Close',
    'common.controls.ok': 'OK',
    'common.controls.save': 'Save',
    'common.controls.clearFilters': 'clear filters',
    'common.controls.confirmChange': 'Confirm Change',
    'common.controls.discard': 'Discard',
    'common.controls.remove': 'Remove',
    'common.controls.update': 'Update',
    'common.controls.checkAll': 'Check All',
    'common.controls.clearAll': 'Clear All',
    'common.controls.add': 'Add',

    'common.alerts.fieldRequired': 'Field required!',
    'common.alerts.fieldIsRequired': 'This field is required.',
    'common.alerts.noSpecialChars': 'Must not contain special characters!',
    'common.alerts.nothingToDisplay': 'No {{term}} to display.',
    'common.alerts.noRemoteClusterDisplay': 'No Remote Clusters to display.',
    'common.alerts.noPrivileges': 'No {{term}} privileges',
    'common.alerts.noPrivilegesDescription': 'This {{term}} does not have any privileges.',
    'common.alerts.timeOut': 'You will be automatically logged out in <b>{{time}}</b> seconds due to inactivity.',
    'common.alerts.isInvalid': '{{term}} Invalid.',
    'common.alerts.cannotSavePermissions': 'Cannot save permissions',
    'common.alerts.cannotLoadPrivileges': 'Cannot load privileges',
    'common.alerts.cannotLoadClusterStatus': 'Cannot load cluster status',
    'common.alerts.clusterRenamed': 'The cluster has been renamed to {{clusterName}}.',
    'common.alerts.remoteClusterRegistered': 'The cluster has been registered as {{clusterName}}.',
    'common.alerts.cannotRenameCluster': 'Cannot rename cluster to {{clusterName}}',
    'common.alerts.minimumTwoChars': 'Minimum length is 2 characters.',
    'common.alerts.maxTwentyFiveChars': 'Maximum length is 25 characters.',
    'common.alerts.onlyText': 'Only lowercase alphanumeric characters are allowed.',
    'common.alerts.onlyAnScore': 'Invalid input, only alphanumerics allowed eg: My_default_view',
    'common.alerts.passwordRequired': 'Password Required',
    'common.alerts.unsavedChanges': 'You have unsaved changes. Save changes or discard?',
    'common.alerts.cannotUpdateStatus': 'Cannot update User status',
    'common.alerts.cannotUpdateAdminStatus': 'Cannot update User Admin status',
    'common.alerts.checkFailed': 'CHECK FAILED',
    'common.alerts.onlySimpleChars': 'Must contain only simple characters.',
    'common.hidden' : 'Hidden',

    'main.title': 'Welcome to Apache Ambari',
    'main.noClusterDescription': 'Provision a cluster, manage who can access the cluster, and customize views for Ambari users.',
    'main.autoLogOut': 'Automatic Logout',

    'main.createCluster.title': 'Create a Cluster',
    'main.createCluster.description': 'Use the Install Wizard to select services and configure your cluster',
    'main.createCluster.launchInstallWizard': 'Launch Install Wizard',

    'main.controls.remainLoggedIn': 'Remain Logged In',
    'main.controls.logOut': 'Log Out Now',

    'views.instance': 'Instance',
    'views.viewInstance': 'View Instance',
    'views.create': 'Create Instance',
    'views.clone': 'Clone Instance',
    'views.edit': 'Edit',
    'views.viewName': 'View Name',
    'views.instances': 'Instances',
    'views.instanceName': 'Instance Name',
    'views.instanceId': 'Instance ID',
    'views.displayName': 'Display Name',
    'views.settings': 'Settings',
    'views.advanced': 'Advanced',
    'views.visible': 'Visible',
    'views.description': 'Description',
    'views.shortUrl': 'Short URL',
    'views.urlName': 'URL Name',
    'views.instanceDescription': 'Instance Description',
    'views.clusterConfiguration': 'Cluster Configuration',
    'views.localCluster': 'Local Cluster',
    'views.remoteCluster': 'Remote Cluster',
    'views.registerRemoteCluster': 'Register Remote Cluster',
    'views.clusterName': 'Cluster Name',
    'views.custom': 'Custom',
    'views.icon': 'Icon',
    'views.icon64': 'Icon64',
    'views.permissions': 'Permissions',
    'views.permission': 'Permission',
    'views.grantUsers': 'Grant permission to these users',
    'views.grantGroups': 'Grant permission to these groups',
    'views.configuration': 'Configuration',
    'views.goToInstance': 'Go to instance',
    'views.pending': 'Pending...',
    'views.deploying': 'Deploying...',
    'views.properties': 'properties',
    'views.urlDelete': 'Delete URL',

    'views.clusterPermissions.label': 'Local Cluster Permissions',
    'views.clusterPermissions.clusteradministrator': 'Cluster Administrator',
    'views.clusterPermissions.clusteroperator': 'Cluster Operator',
    'views.clusterPermissions.clusteruser': 'Cluster User',
    'views.clusterPermissions.serviceadministrator': 'Service Administrator',
    'views.clusterPermissions.serviceoperator': 'Service Operator',
    'views.clusterPermissions.infoMessage': 'Grant <strong>Use</strong> permission for the following <strong>{{cluster}}</strong> Roles:',
    'views.clusterPermissions.nonLocalClusterMessage': 'The ability to inherit view <strong>Use</strong> permission based on Cluster Roles is only available when using a Local Cluster configuration.',

    'views.alerts.noSpecialChars': 'Must not contain any special characters.',
    'views.alerts.noSpecialCharsOrSpaces': 'Must not contain any special characters or spaces.',
    'views.alerts.invalidUrl': 'Must be a valid URL.',
    'views.alerts.instanceExists': 'Instance with this name already exists.',
    'views.alerts.notDefined': 'There are no {{term}} defined for this view.',
    'views.alerts.cannotEditInstance': 'Cannot Edit Static Instances',
    'views.alerts.cannotDeleteStaticInstance': 'Cannot Delete Static Instances',
    'views.alerts.deployError': 'Error deploying. Check Ambari Server log.',
    'views.alerts.cannotUseOption': 'This view cannot use this option',
    'views.alerts.unableToResetErrorMessage': 'Unable to reset error message for prop: {{key}}',
    'views.alerts.instanceCreated': 'Created View Instance {{instanceName}}',
    'views.alerts.unableToParseError': 'Unable to parse error message: {{message}}',
    'views.alerts.cannotCreateInstance': 'Cannot create instance',
    'views.alerts.cannotLoadInstanceInfo': 'Cannot load instance info',
    'views.alerts.cannotLoadPermissions': 'Cannot load permissions',
    'views.alerts.cannotSaveSettings': 'Cannot save settings',
    'views.alerts.cannotSaveProperties': 'Cannot save properties',
    'views.alerts.cannotDeleteInstance': 'Cannot delete instance',
    'views.alerts.cannotLoadViews': 'Cannot load views',
    'views.alerts.cannotLoadViewUrls': 'Cannot load view URLs',
    'views.alerts.cannotLoadViewUrl': 'Cannot load view URL',
    'views.alerts.savedRemoteClusterInformation': 'Remote cluster information is saved.',
    'views.alerts.credentialsUpdated': 'Credentials Updated.',

    'views.table.viewType': 'View Type',
    'views.emptyTable': 'No Views to display',
    'views.createInstance.selectView': 'Select View',
    'views.createInstance.selectVersion': 'Select Version',
    'views.createInstance.clusterType': 'Cluster Type',

    'urls.url': 'URL',
    'urls.viewUrls': 'View URLs',
    'urls.createNewUrl': 'Create New URL',
    'urls.create': 'Create',
    'urls.edit': 'Edit',
    'urls.view': 'View',
    'urls.viewInstance': 'Instance',
    'urls.step1': 'Create URL',
    'urls.step2': 'Select instance',
    'urls.step3': 'Assign URL',
    'urls.noViewInstances': 'No view instances',
    'urls.none': 'None',
    'urls.change': 'Change',
    'urls.urlCreated': 'Created short URL <a href="{{siteRoot}}#/main/view/{{viewName}}/{{shortUrl}}">{{urlName}}</a>',
    'urls.urlUpdated': 'Updated short URL <a href="{{siteRoot}}#/main/view/{{viewName}}/{{shortUrl}}">{{urlName}}</a>',

    'clusters.switchToList': 'Switch&nbsp;to&nbsp;list&nbsp;view',
    'clusters.switchToBlock': 'Switch&nbsp;to&nbsp;block&nbsp;view',
    'clusters.role': 'Role',
    'clusters.assignRoles': 'Assign roles to these {{term}}',

    'clusters.alerts.cannotLoadClusterData': 'Cannot load cluster data',
    'clusters.devBlueprint': 'Cluster Blueprint',

    'groups.createLocal': 'Add Groups',
    'groups.name': 'Group name',
    'groups.role': 'Group Access',
    'groups.addUsers': 'Add users to this group',
    'groups.members': 'Members',
    'groups.membersPlural': '{{n}} member{{n == 1 ? "" : "s"}}',

    'groups.alerts.groupCreated': 'Created group <a href="#/groups/{{groupName}}/edit">{{groupName}}</a>',
    'groups.alerts.groupCreationError': 'Group creation error',
    'groups.alerts.cannotUpdateGroupMembers': 'Cannot update group members',
    'groups.alerts.getGroupsListError': 'Get groups list error',

    'users.username': 'Username',
    'users.user.name': 'User name',
    'users.admin': 'Admin',
    'users.ambariAdmin': 'Ambari Admin',
    'users.ambariClusterURL': 'Ambari Cluster URL',
    'users.changePassword': 'Change Password',
    'users.updateCredentials': 'Update Credentials',
    'users.changePasswordFor': 'Change Password for {{userName}}',
    'users.yourPassword': 'Your Password',
    'users.newPassword': 'New User Password',
    'users.newPasswordConfirmation': 'New User Password Confirmation',
    'users.create': 'Add Users',
    'users.active': 'Active',
    'users.inactive': 'Inactive',
    'users.status': 'Status',
    'users.password': 'Password',
    'users.role': 'User Access',
    'users.confirmPassword': 'Confirm Password',
    'users.passwordConfirmation': 'Password сonfirmation',
    'users.isAmbariAdmin': 'Is this user an Ambari Admin?',
    'users.isActive': 'User Status',
    'users.userIsAdmin': 'This user is an Ambari Admin and has all privileges.',
    'users.showAll': 'Show all users',
    'users.showAdmin': 'Show only admin users',
    'users.groupMembership': 'Group Membership',
    'users.userNameTip': 'Maximum length is 80 characters. \\, &, |, <, >, ` are not allowed.',
    'users.adminTip': 'An Ambari Admin can create new clusters and other Ambari Admin Users.',
    'users.deactivateTip': 'Active Users can log in to Ambari. Inactive Users cannot.',

    'users.changeStatusConfirmation.title': 'Change Status',
    'users.changeStatusConfirmation.message': 'Are you sure you want to change status for user "{{userName}}" to {{status}}?',

    'users.changePrivilegeConfirmation.title': 'Change Admin Privilege',
    'users.changePrivilegeConfirmation.message': 'Are you sure you want to {{action}} Admin privilege to user "{{userName}}"?',
    'users.changePrivilegeConfirmation.revoke': 'revoke',
    'users.changePrivilegeConfirmation.grant': 'grant',

    'users.roles.clusterUser': 'Cluster User',
    'users.roles.clusterAdministrator': 'Cluster Administrator',
    'users.roles.clusterOperator': 'Cluster Operator',
    'users.roles.serviceAdministrator': 'Service Administrator',
    'users.roles.serviceOperator': 'Service Operator',
    'users.roles.ambariAdmin': 'Ambari Administrator',
    'users.roles.viewUser': 'View User',
    'users.roles.none': 'None',
    'users.roles.oneRolePerUserOrGroup': 'Only 1 role allowed per user or group',
    'users.roles.permissionLevel': '{{level}}-level Permissions',

    'users.alerts.passwordRequired': 'Password required',
    'users.alerts.wrongPassword': 'Password must match!',
    'users.alerts.usernameRequired': 'Username Required',
    'users.alerts.cannotChange': 'Cannot Change {{term}}',
    'users.alerts.userCreated': 'Created user <a href="#/users/{{encUserName}}/edit">{{userName}}</a>',
    'users.alerts.userCreationError': 'User creation error',
    'users.alerts.removeUserError': 'Removing from group error',
    'users.alerts.cannotAddUser': 'Cannot add user to group',
    'users.alerts.passwordChanged': 'Password changed.',
    'users.alerts.cannotChangePassword': 'Cannot change password',
    'users.alerts.roleChanged': '{{name}} changed to {{role}}',
    'users.alerts.roleChangedToNone': '{{user_name}}\'s explicit privilege has been changed to \'NONE\'. Any privilege now seen for this user comes through its Group(s).',
    'users.alerts.usersEffectivePrivilege': '{{user_name}}\'s effective privilege through its Group(s) is higher than your selected privilege.',

    'versions.current': 'Current',
    'versions.addVersion': 'Add Version',
    'versions.defaultVersion': '(Default Version Definition)',
    'versions.inUse': 'In Use',
    'versions.installed': 'Installed',
    'versions.usePublic': 'Use Public Repository',

    'versions.networkIssues.networkLost': 'Why is this disabled?',
    'versions.networkIssues.publicDisabledHeader': 'Public Repository Option Disabled',
    'versions.networkIssues.publicRepoDisabledMsg': 'Ambari does not have access to the Internet and cannot use the Public Repository for installing the software. Your Options:',
    'versions.networkIssues.publicRepoDisabledMsg1': 'Configure your hosts for access to the Internet.',
    'versions.networkIssues.publicRepoDisabledMsg2': 'If you are using an Internet Proxy, refer to the Ambari Documentation on how to configure Ambari to use the Internet Proxy.',
    'versions.networkIssues.publicRepoDisabledMsg3': 'Use the Local Repositoy option.',

    'versions.selectVersion': 'Select Version',
    'versions.selectVersionEmpty': 'No other repositories',
    'versions.useLocal': 'Use Local Repository',
    'versions.uploadFile': 'Upload Version Definition File',
    'versions.enterURL': 'Version Definition File URL',
    'versions.URLPlaceholder': 'Enter URL to Version Definition File',
    'versions.defaultURL': 'https://',
    'versions.readInfo': 'Read Version Info',
    'versions.browse': 'Browse',
    'versions.installOn': 'Install on...',

    'versions.register.title': 'Register Version',
    'versions.register.error.header': 'Unable to Register',
    'versions.register.error.body': 'You are attempting to register a version with a Base URL that is already in use with an existing registered version. You *must* review your Base URLs and confirm they are unique for the version you are trying to register.',

    'versions.deregister': 'Deregister Version',
    'versions.deregisterConfirmation': 'Are you sure you want to deregister version <strong>{{versionName}}</strong> ?',
    'versions.placeholder': 'Version Number {{pattern}}',
    'versions.repos': 'Repositories',
    'versions.os': 'OS',
    'versions.baseURL': 'Base URL',
    'versions.skipValidation': 'Skip Repository Base URL validation (Advanced)',
    'versions.noVersions': 'Select version to display details.',
    'versions.patch': 'Patch',
    'versions.introduction': 'To register a new version in Ambari, provide a Version Definition File, confirm the software repository information and save the version.',
    'versions.repoID': 'Repo ID',
    'versions.repoName': 'Repo Name',

    'versions.contents.title': 'Contents',
    'versions.contents.empty': 'No contents to display',

    'versions.details.stackName': 'Stack Name',
    'versions.details.displayName': 'Display Name',
    'versions.details.version': 'Version',
    'versions.details.actualVersion': 'Actual Version',
    'versions.details.releaseNotes': 'Release Notes',

    'versions.repository.placeholder': 'Enter Base URL or remove this OS',
    'versions.repository.add': 'Add Repository',

    'versions.useRedhatSatellite.title': 'Use RedHat Satellite/Spacewalk',
    'versions.useRedhatSatellite.warning': "In order for Ambari to install packages from the right repositories, " +
    "it is recommended that you edit the names of the repo's for each operating system so they match the channel " +
    "names in your RedHat Satellite/Spacewalk instance.",
    'versions.useRedhatSatellite.disabledMsg': 'Use of RedHat Satellite/Spacewalk is not available when using Public Repositories',

    'versions.changeBaseURLConfirmation.title': 'Confirm Base URL Change',
    'versions.changeBaseURLConfirmation.message': 'You are about to change repository Base URLs that are already in use. Please confirm that you intend to make this change and that the new Base URLs point to the same exact Stack version and build',

    'versions.alerts.baseURLs': 'Provide Base URLs for the Operating Systems you are configuring.',
    'versions.alerts.validationFailed': 'Some of the repositories failed validation. Make changes to the base url or skip validation if you are sure that urls are correct',
    'versions.alerts.skipValidationWarning': 'Warning: This is for advanced users only. Use this option if you want to skip validation for Repository Base URLs.',
    'versions.alerts.useRedhatSatelliteWarning': 'Disable distributed repositories and use RedHat Satellite/Spacewalk channels instead',
    'versions.alerts.filterListError': 'Fetch stack version filter list error',
    'versions.alerts.versionCreated': 'Created version <a href="#/stackVersions/{{stackName}}/{{versionName}}/edit">{{stackName}}-{{versionName}}</a>',
    'versions.alerts.versionCreationError': 'Version creation error',
    'versions.alerts.allOsAdded': 'All Operating Systems have been added',
    'versions.alerts.osListError': 'getSupportedOSList error',
    'versions.alerts.readVersionInfoError': 'Version Definition read error',
    'versions.alerts.versionEdited': 'Edited version <a href="#/stackVersions/{{stackName}}/{{versionName}}/edit">{{displayName}}</a>',
    'versions.alerts.versionUpdateError': 'Version update error',
    'versions.alerts.versionDeleteError': 'Version delete error',
    'versions.alerts.repositoryExists': 'A repository with the same Repo ID already exists for {{os}}!',
    'versions.alerts.cannotDeleteInstalled': 'Cannot delete version already installed.',

    'authentication.description': 'Ambari supports authenticating against local Ambari users created and stored in the Ambari Database, or authenticating against a LDAP server:',
    'authentication.ldap': 'LDAP Authentication',
    'authentication.on': 'On',
    'authentication.off': 'Off',

    'authentication.connectivity.title': 'LDAP Connectivity Configuration',
    'authentication.connectivity.host': 'LDAP Server Host',
    'authentication.connectivity.port': 'LDAP Server Port',
    'authentication.connectivity.ssl': 'Use SSL?',

    'authentication.connectivity.trustStore.label': 'Trust Store',

    'authentication.connectivity.trustStorePath': 'Trust Store Path',

    'authentication.connectivity.trustStoreType.label': 'Trust Store Type',

    'authentication.connectivity.trustStorePassword': 'Trust Store Password',
    'authentication.connectivity.dn': 'Bind DN',
    'authentication.connectivity.bindPassword': 'Bind Password',

    'authentication.connectivity.controls.testConnection': 'Test Connection',

    'authentication.attributes.title': 'LDAP Attribute Configuration',

    'authentication.attributes.detection.label': 'Identifying the proper attributes to be used when authenticating and looking up users and groups can be specified manually, or automatically detected. Please choose:',

    'authentication.attributes.detection.options.manual': 'Define Attributes Manually',
    'authentication.attributes.detection.options.auto': 'Auto-Detect Attributes',

    'authentication.attributes.userSearch': 'User Search Base',
    'authentication.attributes.groupSearch': 'Group Search Base',
    'authentication.attributes.detected': 'The following attributes were detected, please review and Test Attributes to ensure their accuracy.',
    'authentication.attributes.userObjClass': 'User Object Class',
    'authentication.attributes.userNameAttr': 'User Name Attribute',
    'authentication.attributes.groupObjClass': 'Group Object Class',
    'authentication.attributes.groupNameAttr': 'Group Name Attribute',
    'authentication.attributes.groupMemberAttr': 'Group Member Attribute',
    'authentication.attributes.distinguishedNameAttr': 'Distinguished Name Attribute',

    'authentication.attributes.test.description': 'To quickly test the chosen attributes click the button below. During this process you can specify a test user name and password and Ambari will attempt to authenticate and retrieve group membership information',
    'authentication.attributes.test.username': 'Test Username',
    'authentication.attributes.test.password': 'Test Password',

    'authentication.attributes.groupsList': 'List of Groups',

    'authentication.attributes.controls.autoDetect': 'Perform Auto-Detection',
    'authentication.attributes.controls.testAttrs': 'Test Attributes',

    'authentication.attributes.alerts.successfulAuth': 'Successful Authentication',

    'authentication.controls.test': 'Test',

    'exportBlueprint.dataLoaded': 'Data loaded...',

    'remoteClusters.ambariClusterName': 'Ambari Cluster Name',
    'remoteClusters.clusterURLPlaceholder': 'http://ambari.server:8080/api/v1/clusters/c1',

    'remoteClusters.alerts.fetchError': 'Error in fetching remote clusters.'
  });

  $translateProvider.preferredLanguage('en');
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('ClusterInformationCtrl',
['$scope', '$http', '$location', 'Cluster', '$routeParams', '$translate', '$rootScope', 'ConfirmationModal', 'Alert',
function($scope, $http, $location, Cluster, $routeParams, $translate, $rootScope, ConfirmationModal, Alert) {
  var $t = $translate.instant;
  $scope.isDataLoaded = false;
  $scope.edit = {
    clusterName: null
  };
  $scope.isClusterNameEdited = false;
  $scope.nameValidationPattern = /^\s*\w*\s*$/;

  $scope.$watch(function() {
    return $rootScope.cluster;
  }, function() {
    $scope.cluster = $rootScope.cluster;
    if ($scope.cluster) {
      $scope.edit.clusterName = $scope.cluster.Clusters.cluster_name;
      $scope.getBlueprint();
    }
  }, true);

  $scope.getBlueprint = function () {
    Cluster.getBlueprint({
      clusterName: $scope.cluster.Clusters.cluster_name
    }).then(function (data) {
      console.debug($t('exportBlueprint.dataLoaded'), data);
      $scope.isDataLoaded = true;
      var response = JSON.stringify(data, null, 4),
        lt = /&lt;/g,
        gt = /&gt;/g,
        ap = /&#39;/g,
        ic = /&#34;/g;
      $scope.blueprint = response ? response.toString().replace(lt, "<").replace(gt, ">").replace(ap, "'").replace(ic, '"') : "";
    });
  };

  $scope.downloadBlueprint = function () {
    if (window.navigator.msSaveOrOpenBlob) {
      var blob = new Blob([decodeURIComponent(encodeURIComponent($scope.blueprint))], {
        type: "text/csv;charset=utf-8;"
      });
      navigator.msSaveBlob(blob, 'blueprint.json');
    } else {
      var a = document.createElement('a');
      a.href = 'data:attachment/json;charset=utf-8,' + encodeURIComponent($scope.blueprint);
      a.target = '_blank';
      a.download = 'blueprint.json';
      document.body.appendChild(a);
      a.click();
    }
  };

  $scope.toggleSaveButton = function() {
    var value = $scope.edit.clusterName;
    $scope.isClusterNameEdited = (value !== null && $scope.cluster.Clusters.cluster_name !== value);
  };

  $scope.confirmClusterNameChange = function() {
    ConfirmationModal.show(
      $t('common.clusterNameChangeConfirmation.title'),
      $t('common.clusterNameChangeConfirmation.message', {
        clusterName: $scope.edit.clusterName
      })
    )
      .then(function () {
        $scope.saveClusterName();
      }).catch(function () {
      // user clicked cancel
      $scope.edit.clusterName = $scope.cluster.Clusters.cluster_name;
      $scope.toggleSaveButton();
    });
  };

  $scope.saveClusterName = function() {
    var oldClusterName = $scope.cluster.Clusters.cluster_name,
        newClusterName = $scope.edit.clusterName;

    Cluster.editName(oldClusterName, newClusterName).then(function() {
      $scope.cluster.Clusters.cluster_name = newClusterName;
      $scope.edit.clusterName = newClusterName;
      $scope.toggleSaveButton();
      Alert.success($t('common.alerts.clusterRenamed', {clusterName: newClusterName}));
    }).catch(function(data) {
      Alert.error($t('common.alerts.cannotRenameCluster', {clusterName: newClusterName}), data.data.message);
    });
  };
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('AppCtrl',['$scope','$rootScope', '$route', '$window','Auth', 'Alert', '$modal', 'Cluster', '$translate', '$http', 'Settings', 'Utility', '$q', function($scope, $rootScope, $route, $window, Auth, Alert, $modal, Cluster, $translate, $http, Settings, Utility, $q) {
  var $t = $translate.instant;
  $scope.signOut = function () {
    Auth.signout().finally(function () {
      $window.location.pathname = Settings.siteRoot;
    });
  };

  //todo replace with breadcrumb service
  $scope.$watch(function () {
    return $route.current;
  }, function (value) {
    var breadcrumbs = [$t('common.admin')];
    if (value && value.$$route && value.$$route.label) {
      breadcrumbs.push(value.$$route.label);
    }
    $scope.breadcrumbs = breadcrumbs;
  });


  $scope.ambariVersion = null;
  $rootScope.supports = {};
  $rootScope.authDataLoad = $q.defer();

  Utility.getUserPref('user-pref-' + Auth.getCurrentUser() + '-supports').then(function (data) {
    $rootScope.supports = data.data ? data.data : {};
  });

  $http.get(Settings.baseUrl + '/users/' + Auth.getCurrentUser() + '/authorizations?fields=*')
    .then(function (data) {
      var auth = !!data.data && !!data.data.items ? data.data.items.map(function (a) {
          return a.AuthorizationInfo.authorization_id;
        }) : [],
        canPersistData = auth.indexOf('CLUSTER.MANAGE_USER_PERSISTED_DATA') > -1;
      $rootScope.authDataLoad.resolve(canPersistData);
      if (auth.indexOf('AMBARI.RENAME_CLUSTER') == -1) {
        $window.location = $rootScope.fromSiteRoot("/#/main/dashboard");
      }
    });

  $scope.about = function () {
    var ambariVersion = $scope.ambariVersion;
    var modalInstance = $modal.open({
      templateUrl: 'views/modals/AboutModal.html',
      controller: ['$scope', function ($scope) {
        $scope.ok = function () {
          modalInstance.close();
        };
        $scope.ambariVersion = ambariVersion;
      }]
    });
  };

  $scope.currentUser = Auth.getCurrentUser();

  $scope.cluster = null;
  $scope.isLoaded = null;

  function loadAmbariVersion() {
    Cluster.getAmbariVersion().then(function (version) {
      $scope.ambariVersion = version;
    });
  }

  function loadClusterData() {
    Cluster.getStatus().then(function (cluster) {
      $rootScope.cluster = cluster;
      $scope.cluster = cluster;
      $scope.isLoaded = true;
      if (cluster && cluster.Clusters.provisioning_state === 'INIT') {
        setTimeout(loadClusterData, 1000);
      }
    }).catch(function (data) {
      Alert.error($t('common.alerts.cannotLoadClusterStatus'), data.statusText);
    });
  }

  loadClusterData();
  loadAmbariVersion();

  $scope.startInactiveTimeoutMonitoring = function (timeout) {
    var TIME_OUT = timeout;
    var active = true;
    var lastActiveTime = Date.now();

    var keepActive = function () {
      if (active) {
        lastActiveTime = Date.now();
      }
    };

    $(window).bind('mousemove', keepActive);
    $(window).bind('keypress', keepActive);
    $(window).bind('click', keepActive);

    var checkActiveness = function () {
      var remainTime = TIME_OUT - (Date.now() - lastActiveTime);
      if (remainTime < 0) {
        active = false;
        $(window).unbind('mousemove', keepActive);
        $(window).unbind('keypress', keepActive);
        $(window).unbind('click', keepActive);
        clearInterval($rootScope.userActivityTimeoutInterval);
        $scope.signOut();
      } else if (remainTime < 60000 && !$rootScope.timeoutModal) {
        $rootScope.timeoutModal = $modal.open({
          templateUrl: 'views/modals/TimeoutWarning.html',
          backdrop: false,
          controller: ['$scope', 'Auth', function ($scope, Auth) {
            $scope.remainTime = 60;
            $scope.title = $t('main.autoLogOut');
            $scope.primaryText = $t('main.controls.remainLoggedIn');
            $scope.secondaryText = $t('main.controls.logOut');
            $scope.remain = function () {
              $rootScope.timeoutModal.close();
              delete $rootScope.timeoutModal;
            };
            $scope.logout = function () {
              $rootScope.timeoutModal.close();
              delete $rootScope.timeoutModal;
              Auth.signout().finally(function () {
                $window.location.pathname = Settings.siteRoot;
              });
            };
            $scope.countDown = function () {
              $scope.remainTime--;
              $scope.$apply();
              if ($scope.remainTime == 0) {
                Auth.signout().finally(function () {
                  $window.location.pathname = Settings.siteRoot;
                });
              }
            };
            setInterval($scope.countDown, 1000);
          }]
        });
      }
    };
    $rootScope.userActivityTimeoutInterval = window.setInterval(checkActiveness, 1000);
  };

  // Send noop requests every 10 seconds just to keep backend session alive
  $scope.startNoopPolling = function () {
    $rootScope.noopPollingInterval = setInterval(Cluster.getAmbariTimeout, 10000);
  };

  if (!$rootScope.userActivityTimeoutInterval) {
    Cluster.getAmbariTimeout().then(function (timeout) {
      $rootScope.userTimeout = Number(timeout) * 1000;
      if ($rootScope.userTimeout > 0)
        $scope.startInactiveTimeoutMonitoring($rootScope.userTimeout);
    });
  }
  if (!$rootScope.noopPollingInterval) {
    $scope.startNoopPolling();
  }
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('SideNavCtrl', ['$scope', '$location', 'ROUTES', '$rootScope', 'Stack', 'Settings', function($scope, $location, ROUTES, $rootScope, Stack, Settings) {
  $scope.totalRepos = 0;
  $scope.settings = Settings;

  $scope.$watch(function() {
    return $rootScope.cluster;
  }, function() {
    $scope.cluster = $rootScope.cluster;
  }, true);

  function loadRepos() {
    Stack.allRepos().then(function (repos) {
      $scope.totalRepos = repos.itemTotal;
    });
  }

  function initNavigationBar () {
    $('body').on('DOMNodeInserted', '.navigation-bar', function() {
      $('.navigation-bar').navigationBar({
        fitHeight: true,
        collapseNavBarClass: 'fa-angle-double-left',
        expandNavBarClass: 'fa-angle-double-right'
      });
      //initTooltips();
      $('body').off('DOMNodeInserted', '.navigation-bar');
    });
  }

  function initTooltips () {
    $('[rel="tooltip"]').tooltip();
  }

  initNavigationBar();
  loadRepos();

  $scope.isActive = function(path) {
    var route = ROUTES;
    angular.forEach(path.split('.'), function(routeObj) {
      route = route[routeObj];
    });
    var r = new RegExp( route.url.replace(/(:\w+)/, '\\w+'));
    return r.test($location.path());
  };
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
  .controller('AuthenticationMainCtrl', ['$scope', '$translate', 'Alert', 'Settings', function ($scope, $translate, $Alert, Settings) {
    $scope.t = $translate.instant;
    $scope.settings = Settings;

    $scope.isLDAPEnabled = false;
    $scope.connectivity = {
      trustStore: 'default',
      trustStoreOptions: ['default', 'custom'],
      trustStoreType: 'jks',
      trustStoreTypeOptions: ['jks', 'jceks', 'pkcs12']
    };
    $scope.attributes = {
      detection: 'auto'
    };

    $scope.isConnectivityFormInvalid = true;
    $scope.isAutoDetectFormInvalid = true;
    $scope.isAttributesFormInvalid = true;
    $scope.isTestAttributesFormInvalid = false;

    $scope.isRequestRunning = false;

    $scope.isConnectionTestRunning = false;
    $scope.isConnectionTestComplete = false;
    $scope.hasConnectionTestPassed = false;

    $scope.isAttributeDetectionRunning = false;
    $scope.isAttributeDetectionComplete = false;
    $scope.isAttributeDetectionSuccessful = false;

    $scope.isTestAttributesRunning = false;
    $scope.isTestAttributesComplete = false;
    $scope.isTestAttributesSuccessful = false;

    $scope.isSaving = false;
    $scope.isSavingComplete = false;
    $scope.isSavingSuccessful = false;

    $scope.isTestAttributesFormShown = false;

    $scope.toggleAuthentication = function () {
      $scope.isConnectionTestRunning = false;
      $scope.isConnectionTestComplete = false;
      $scope.hasConnectionTestPassed = false;
    };

    $scope.testConnection = function () {
      $scope.isConnectionTestRunning = true;
      $scope.isConnectionTestComplete = false;
      $scope.isAttributeDetectionRunning = false;
      $scope.isAttributeDetectionComplete = false;
      $scope.isAttributeDetectionSuccessful = false;

      // TODO replace mock with test connection request when API is available
      setTimeout(function (prevValue) {
        $scope.isConnectionTestRunning = false;
        $scope.isConnectionTestComplete = true;
        $scope.hasConnectionTestPassed = !prevValue;
      }, 1000, $scope.hasConnectionTestPassed);
      $scope.hasConnectionTestPassed = false;
    };

    $scope.detectAttributes = function () {
      $scope.isAttributeDetectionRunning = true;
      $scope.isAttributeDetectionComplete = false;

      // TODO replace mock with attributes detection request when API is available
      setTimeout(function (prevValue) {
        $scope.isAttributeDetectionRunning = false;
        $scope.isAttributeDetectionComplete = true;
        $scope.isAttributeDetectionSuccessful = !prevValue;
        if ($scope.isAttributeDetectionSuccessful) {
          var form = $scope.attributes;
          form.userObjClass = 'person';
          form.userNameAttr = 'sAMAccountName';
          form.groupObjClass = 'group';
          form.groupNameAttr = 'cn';
          form.groupMemberAttr = 'member';
          form.distinguishedNameAttr = 'distinguishedName';
        }
      }, 1000, $scope.isAttributeDetectionSuccessful);

      $scope.isAttributeDetectionSuccessful = false;
    };

    $scope.showTestAttributesForm = function () {
      $scope.isTestAttributesFormShown = true;
    };

    $scope.testAttributes = function () {
      $scope.isTestAttributesRunning = true;
      $scope.isTestAttributesComplete = false;

      // TODO replace mock with test attributes request when API is available
      setTimeout(function (prevValue) {
        $scope.isTestAttributesRunning = false;
        $scope.isTestAttributesComplete = true;
        $scope.isTestAttributesSuccessful = !prevValue;
        if ($scope.isTestAttributesSuccessful) {
          $scope.attributes.availableGroups = ['HadoopOps', 'HadoopOpsDFW', 'AmbariAdmins', 'ExchangeAdmins', 'AmbariUsers', 'ExchangeUsers'];
        }
      }, 1000, $scope.isTestAttributesSuccessful);
      $scope.isTestAttributesSuccessful = false;
    };

    $scope.save = function () {
      $scope.isSaving = true;
      $scope.isSavingComplete = false;
      // TODO replace mock with save request when API is available
      setTimeout(function (prevValue) {
        $scope.isSaving = false;
        $scope.isSavingComplete = true;
        $scope.isSavingSuccessful = !prevValue;
        if ($scope.isSavingSuccessful) {
          $Alert.success('Settings saved');
        } else {
          $Alert.error('Saving failed', '500 Error');
        }
      }, 1000, $scope.isSavingSuccessful);
      $scope.isSavingSuccessful = false;
    };

    $scope.$watch('connectivity', function (form, oldForm, scope) {
      scope.isConnectivityFormInvalid = !(form.host && form.port
        && (form.trustStore === 'default' || form.trustStorePath && form.trustStorePassword)
        && form.dn && form.bindPassword);
    }, true);

    $scope.$watch('attributes', function (form, oldForm, scope) {
      scope.isAutoDetectFormInvalid = !(form.userSearch && form.groupSearch);
      scope.isAttributesFormInvalid = !(form.userObjClass && form.userNameAttr && form.groupObjClass
        && form.groupNameAttr && form.groupMemberAttr && form.distinguishedNameAttr
        && (form.detection === 'auto' || form.userSearchManual && form.groupSearchManual));
      scope.isTestAttributesFormInvalid = !(form.username && form.password);
    }, true);

    $scope.$watch('attributes.detection', function (newValue, oldValue, scope) {
      scope.isTestAttributesFormShown = false;
      scope.isAttributeDetectionComplete = false;
      scope.isAttributeDetectionSuccessful = false;
    });

    $scope.$watch(function (scope) {
      return scope.isConnectionTestRunning || scope.isAttributeDetectionRunning || scope.isTestAttributesRunning || scope.isSaving;
    }, function (newValue, oldValue, scope) {
      scope.isRequestRunning = newValue;
    });
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
  .controller('LoginActivitiesMainCtrl',['$scope', '$location', function($scope, $location) {
    $scope.tab = $location.path().substr(1) == "loginActivities" ? "loginMessage" : $location.path().substr(1);
  }]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
  .controller('LoginMessageMainCtrl',['$scope', 'Alert', '$timeout', '$location', '$http', '$translate', 'UnsavedDialog', function($scope, Alert, $timeout, $location, $http, $translate, UnsavedDialog) {
    var $t = $translate.instant,
      targetUrl = '/loginActivities';

    $scope.getMOTD = function() {
      $http.get('/api/v1/settings/motd').then(function (res) {
        $scope.motdExists = true;
        var
          response = JSON.parse(res.data.Settings.content.replace(/\n/g, "\\n")),
          lt = /&lt;/g,
          gt = /&gt;/g,
          ap = /&#39;/g,
          ic = /&#34;/g;

        $scope.text = response.text ? response.text.toString().replace(lt, "<").replace(gt, ">").replace(ap, "'").replace(ic, '"') : "";
        $scope.buttonText = response.button ? response.button.toString().replace(lt, "<").replace(gt, ">").replace(ap, "'").replace(ic, '"') : "OK";
        $scope.status = response.status && response.status == "true" ? true : false;
      }, function(response) {
        $scope.status = false;
        $scope.motdExists = false;
        $scope.text = "";
        $scope.buttonText = $t('common.controls.ok');
      });
      $scope.submitDisabled = true;
    };

    $scope.inputChangeEvent = function(){
      $scope.submitDisabled = false;
    };
    $scope.changeStatus = function(){
      $scope.submitDisabled = false;
    };

    $scope.cancel = function() {
      $scope.getMOTD();
    };

    $scope.$watch(function(scope) {
      return scope.submitDisabled;
    }, function(submitDisabled) {
      $scope.form.$dirty = !submitDisabled
    });

    $scope.saveLoginMsg = function(targetUrl) {
      var
        method = $scope.motdExists ? 'PUT' : 'POST',
        text = "",
        buttonText = "",
        lt = /</g,
        gt = />/g,
        ap = /'/g,
        ic = /"/g;

      text = $scope.text.toString().replace(lt, "&lt;").replace(gt, "&gt;").replace(ap, "&#39;").replace(ic, "&#34;");
      buttonText = $scope.buttonText ? $scope.buttonText.toString().replace(lt, "&lt;").replace(gt, "&gt;").replace(ap, "&#39;").replace(ic, "&#34;") : $scope.buttonText;

      var data = {
        'Settings' : {
          'content' : '{"text":"' + text + '", "button":"' + buttonText + '", "status":"' + $scope.status + '"}',
          'name' : 'motd',
          'setting_type' : 'ambari-server'
        }
      };
      $scope.form.submitted = true;
      if ($scope.form.$valid){
        $scope.submitDisabled = true;
        return $http({
          method: method,
          url: '/api/v1/settings/' + ($scope.motdExists ? 'motd' : ''),
          data: data
        }).then(function successCallback() {
          $scope.motdExists = true;
          targetUrl ? $location.path(targetUrl) : "";
        }, function errorCallback(data) {
          $scope.submitDisabled = false;
          Alert.error($t('common.loginActivities.saveError'), data.data.message);
        });
      }
    };

    $scope.$on('$locationChangeStart', function(event, __targetUrl) {
      if( $scope.form.$dirty ){
        UnsavedDialog().then(function(action) {
          targetUrl = __targetUrl.split('#').pop();
          switch(action){
            case 'save':
              $scope.saveLoginMsg(targetUrl);
              break;
            case 'discard':
              $scope.form.$setPristine();
              $location.path(targetUrl);
              break;
            case 'cancel':
              targetUrl = '/loginActivities';
              break;
          }
        });
        event.preventDefault();
      }
    });

  }]);

  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  'use strict';
  
  angular.module('ambariAdminConsole')
    .controller('HomeDirectoryCtrl', ['$scope', '$location', 'UnsavedDialog', function($scope, $location, UnsavedDialog) {

      $scope.TEMPLATE_PLACEHOLER = '/user/{{username}}';
      $scope.autoCreate = false;
      $scope.template = '';
      $scope.group = '';
      $scope.permissions = '';
  
      $scope.save = function (targetUrl) {
        targetUrl ? $location.path(targetUrl) : "";
      }
  
      $scope.$on('$locationChangeStart', function(event, __targetUrl) {
        if( $scope.form.$dirty ){
          UnsavedDialog().then(function(action) {
            var targetUrl = __targetUrl.split('#').pop();
            switch(action){
              case 'save':
                $scope.save(targetUrl);
                $scope.form.$setPristine();
                break;
              case 'discard':
                $scope.form.$setPristine();
                $location.path(targetUrl);
                break;
              case 'cancel':
                targetUrl = '/homeDirectory';
                break;
            }
          });
          event.preventDefault();
        }
      });
    }]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('UserManagementCtrl', ['$scope', '$routeParams', function($scope, $routeParams) {
  $scope.activeTab = $routeParams.tab === 'groups' ? 'GROUPS' : 'USERS';
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('UserCreateCtrl',
['$scope', '$rootScope', 'User', '$location', 'Alert', 'UnsavedDialog', '$translate', 'Cluster', '$modalInstance', 'RoleDetailsModal',
function($scope, $rootScope, User, $location, Alert, UnsavedDialog, $translate, Cluster, $modalInstance, RoleDetailsModal) {
  var $t = $translate.instant;

  $scope.form = {};
  $scope.formData = {
    userName: '',
    password: '',
    confirmPassword: '',
    role: '',
    isAdmin: false,
    isActive: true
  };
  $scope.roleOptions = [];

  function loadRoles() {
    return Cluster.getRoleOptions().then(function (data) {
      $scope.roleOptions = data;
    });
  }

  function unsavedChangesCheck() {
    if ($scope.form.userCreateForm.$dirty) {
      UnsavedDialog().then(function (action) {
        switch (action) {
          case 'save':
            $scope.save();
            break;
          case 'discard':
            $modalInstance.close('discard');
            break;
          case 'cancel':
            break;
        }
      });
    } else {
      $modalInstance.close('discard');
    }
  }

  $scope.showHelpPage = function() {
    Cluster.getRolesWithAuthorizations().then(function(roles) {
      RoleDetailsModal.show(roles);
    });
  };

  $scope.save = function () {
    $scope.form.userCreateForm.submitted = true;
    if ($scope.form.userCreateForm.$valid) {
      User.create({
        'Users/user_name': $scope.formData.userName,
        'Users/password': $scope.formData.password,
        'Users/active': Boolean($scope.formData.isActive),
        'Users/admin': Boolean($scope.formData.isAdmin)
      }).then(function () {
        saveRole();
        $modalInstance.dismiss('created');
        Alert.success($t('users.alerts.userCreated', {
          userName: $scope.formData.userName,
          encUserName: encodeURIComponent($scope.formData.userName)
        }));
      }).catch(function (data) {
        Alert.error($t('users.alerts.userCreationError'), data.data.message);
      });
    }
  };

  function saveRole() {
    if (!$scope.formData.role || $scope.formData.role === 'NONE') {
      return;
    }
    Cluster.createPrivileges(
      {
        clusterId: $rootScope.cluster.Clusters.cluster_name
      },
      [{PrivilegeInfo: {
        permission_name: $scope.formData.role,
        principal_name: $scope.formData.userName,
        principal_type: 'USER'
      }}]
    )
    .catch(function(data) {
      Alert.error($t('common.alerts.cannotSavePermissions'), data.data.message);
    });
  }

  $scope.cancel = function () {
    unsavedChangesCheck();
  };

  loadRoles();
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('UsersListCtrl',
['$scope', 'User', '$modal', '$rootScope', 'UserConstants', '$translate', 'Cluster', 'View', 'ConfirmationModal', 'Settings', 'Pagination', 'Filters',
function($scope, User, $modal, $rootScope, UserConstants, $translate, Cluster, View, ConfirmationModal, Settings, Pagination, Filters) {
  var $t = $translate.instant;
  $scope.constants = {
    admin: $t('users.ambariAdmin'),
    users: $t('common.users').toLowerCase()
  };
  $scope.users = [];
  $scope.minRowsToShowPagination = Settings.minRowsToShowPagination;
  $scope.isLoading = false;
  $scope.pagination = Pagination.create();
  $scope.tableInfo = {
    filtered: 0,
    total: 0,
    showed: 0
  };
  $scope.filters = [
    {
      key: 'user_name',
      label: $t('users.username'),
      customValueConverter: function(item) {
        return item.Users.user_name;
      },
      options: []
    },
    {
      key: 'role',
      label: $t('clusters.role'),
      customValueConverter: function(item) {
        return item.Users.roles[0] ? item.Users.roles[0].permission_label : '';
      },
      options: []
    },
    {
      key: 'status',
      label: $t('users.status'),
      isStatic: true,
      customValueConverter: function(item) {
        return item.Users.active ? $t('users.active') : $t('users.inactive');
      },
      options: [
        {
          key: $t('users.active'),
          label: $t('users.active')
        },
        {
          key: $t('users.inactive'),
          label: $t('users.inactive')
        }
      ]
    },
    {
      key: 'type',
      label: $t('common.type'),
      customValueConverter: function(item) {
        return item.Users.userTypeName;
      },
      options: []
    },
    {
      key: 'group',
      label: $t('common.group'),
      isMultiple: true,
      customValueConverter: function(item) {
        return item.Users.groups;
      },
      options: []
    }
  ];

  function loadUsers() {
    $scope.isLoading = true;
    User.list().then(function (data) {
      $scope.users = data.data.items.map(User.makeUser);
      $scope.tableInfo.total = $scope.users.length;
      $scope.filterUsers();
      Filters.initFilterOptions($scope.filters, $scope.users);
    }).finally(function () {
      $scope.isLoading = false;
    });
  }

  $scope.toggleSearchBox = function() {
    $('.search-box-button .popup-arrow-up, .search-box-row').toggleClass('hide');
  };

  $scope.pageChanged = function () {
    $scope.pagination.pageChanged($scope.users, $scope.tableInfo);
  };

  $scope.resetPagination = function () {
    $scope.pagination.resetPagination($scope.users, $scope.tableInfo);
  };

  $scope.filterUsers = function(appliedFilters) {
    $scope.tableInfo.filtered = Filters.filterItems(appliedFilters, $scope.users, $scope.filters);
    $scope.pagination.resetPagination($scope.users, $scope.tableInfo);
  };

  $rootScope.$watch(function (scope) {
    return scope.LDAPSynced;
  }, function (LDAPSynced) {
    if (LDAPSynced === true) {
      $rootScope.LDAPSynced = false;
      loadUsers();
    }
  });

  $scope.createUser = function () {
    var modalInstance = $modal.open({
      templateUrl: 'views/userManagement/modals/userCreate.html',
      controller: 'UserCreateCtrl',
      backdrop: 'static'
    });

    modalInstance.result.finally(loadUsers);
  };

  $scope.deleteUser = function (user) {
    if (!user.isDeletable) {
      return false;
    }
    ConfirmationModal.show(
      $t('common.delete', {
        term: $t('common.user')
      }),
      $t('common.deleteConfirmation', {
        instanceType: $t('common.user').toLowerCase(),
        instanceName: '"' + user.user_name + '"'
      }),
      null,
      null,
      {primaryClass: 'btn-danger'}
    ).then(function () {
      Cluster.getPrivilegesForResource({
        nameFilter: user.user_name,
        typeFilter: {value: 'USER'}
      }).then(function (data) {
        var clusterPrivilegesIds = [];
        var viewsPrivileges = [];
        if (data.items && data.items.length) {
          angular.forEach(data.items[0].privileges, function (privilege) {
            if (privilege.PrivilegeInfo.principal_type === 'USER') {
              if (privilege.PrivilegeInfo.type === 'VIEW') {
                viewsPrivileges.push({
                  id: privilege.PrivilegeInfo.privilege_id,
                  view_name: privilege.PrivilegeInfo.view_name,
                  version: privilege.PrivilegeInfo.version,
                  instance_name: privilege.PrivilegeInfo.instance_name
                });
              } else {
                clusterPrivilegesIds.push(privilege.PrivilegeInfo.privilege_id);
              }
            }
          });
        }
        User.delete(user.user_name).then(function () {
          if (clusterPrivilegesIds.length) {
            Cluster.deleteMultiplePrivileges($rootScope.cluster.Clusters.cluster_name, clusterPrivilegesIds);
          }
          angular.forEach(viewsPrivileges, function (privilege) {
            View.deletePrivilege(privilege);
          });
          loadUsers();
        });
      });
    });
  };

  loadUsers();

}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('UserEditCtrl',
['$scope', '$rootScope', '$routeParams', 'Cluster', 'User', 'View', '$modal', '$location', 'ConfirmationModal', 'Alert', 'Auth', 'getDifference', 'Group', '$q', 'UserConstants', '$translate', 'RoleDetailsModal',
function($scope, $rootScope, $routeParams, Cluster, User, View, $modal, $location, ConfirmationModal, Alert, Auth, getDifference, Group, $q, UserConstants, $translate, RoleDetailsModal) {

  var $t = $translate.instant;
  var nonRole = {
    permission_name: 'NONE',
    permission_label: $t('users.roles.none')
  };

  $scope.constants = {
    user: $t('common.user'),
    status: $t('users.status'),
    admin: $t('users.admin'),
    password: $t('users.password'),
    view: $t('common.view').toLowerCase(),
    cluster: $t('common.cluster').toLowerCase()
  };

  $scope.user = null;
  $scope.isCurrentUser = true;
  $scope.dataLoaded = false;
  $scope.isGroupEditing = false;

  $scope.enableGroupEditing = function () {
    $scope.isGroupEditing = true;
    $scope.editingGroupsList = angular.copy($scope.user.groups);
  };

  $scope.$watch(function () {
    return $scope.editingGroupsList;
  }, function (newValue) {
    if (newValue) {
      if (!angular.equals(newValue, $scope.user.groups)) {
        $scope.updateGroups();
      }
    }
  }, true);

  $scope.showHelpPage = function() {
    Cluster.getRolesWithAuthorizations().then(function(roles) {
      RoleDetailsModal.show(roles);
    });
  };

  $scope.updateRole = function () {
    var clusterName = $rootScope.cluster.Clusters.cluster_name;
    if ($scope.originalRole.permission_name !== $scope.currentRole.permission_name) {
      if ($scope.currentRole.permission_name === 'NONE') {
        deleteUserRoles(clusterName, $scope.user).finally(loadUserInfo);
      } else {
        if ($scope.user.roles.length) {
          deleteUserRoles(clusterName, $scope.user, true).finally(function() {
            addUserRoles(clusterName, $scope.currentRole, $scope.user).finally(loadUserInfo);
          });
        } else {
          addUserRoles(clusterName, $scope.currentRole, $scope.user).finally(loadUserInfo);
        }
      }
    }
  };

  $scope.updateGroups = function () {
    var groups = $scope.editingGroupsList.filter(function (item) {
      return item.trim();
    }).map(function (item) {
      return item.trim();
    });
    var diff = getDifference($scope.user.groups, groups);
    var promises = [];
    // Remove user from groups
    angular.forEach(diff.del, function (groupName) {
      promises.push(Group.removeMemberFromGroup(groupName, $scope.user.user_name).catch(function (data) {
        Alert.error($t('users.alerts.removeUserError'), data.data.message);
      }));
    });
    // Add user to groups
    angular.forEach(diff.add, function (groupName) {
      promises.push(Group.addMemberToGroup(groupName, $scope.user.user_name).catch(function (data) {
        Alert.error($t('users.alerts.cannotAddUser'), data.data.message);
      }));
    });
    $q.all(promises).then(function () {
      loadUserInfo();
    });
    $scope.isGroupEditing = false;
  };

  $scope.getUserMembership = function (userType) {
    if (userType) {
      return $t(UserConstants.TYPES[userType].LABEL_KEY) + " " + $t('users.groupMembership');
    }
  };

  $scope.cancelUpdate = function () {
    $scope.isGroupEditing = false;
    $scope.editingGroupsList = '';
  };

  $scope.openChangePwdDialog = function () {
    var modalInstance = $modal.open({
      templateUrl: 'views/userManagement/modals/changePassword.html',
      resolve: {
        userName: function () {
          return $scope.user.user_name;
        }
      },
      controller: ['$scope', 'userName', function ($scope, userName) {
        $scope.passwordData = {
          password: '',
          currentUserPassword: ''
        };

        $scope.form = {};
        $scope.userName = userName;

        $scope.ok = function () {
          $scope.form.passwordChangeForm.submitted = true;
          if ($scope.form.passwordChangeForm.$valid) {
            modalInstance.close({
              password: $scope.passwordData.password,
              currentUserPassword: $scope.passwordData.currentUserPassword
            });
          }
        };
        $scope.cancel = function () {
          modalInstance.dismiss('cancel');
        };
      }]
    });

    modalInstance.result.then(function (data) {
      User.setPassword($scope.user, data.password, data.currentUserPassword).then(function () {
        Alert.success($t('users.alerts.passwordChanged'));
      }).catch(function (data) {
        Alert.error($t('users.alerts.cannotChangePassword'), data.data.message);
      });
    });
  };

  $scope.toggleUserActive = function () {
    if (!$scope.isCurrentUser) {
      var newStatusKey = $scope.user.active ? 'inactive' : 'active';
      ConfirmationModal.show(
        $t('users.changeStatusConfirmation.title'),
        $t('users.changeStatusConfirmation.message', {
          userName: $scope.user.user_name,
          status: $t('users.' + newStatusKey).toLowerCase()
        })
      ).then(function () {
        User.setActive($scope.user.user_name, $scope.user.active)
        .catch(function (data) {
          Alert.error($t('common.alerts.cannotUpdateStatus'), data.data.message);
          $scope.user.active = !$scope.user.active;
        });
      })
      .catch(function () {
        $scope.user.active = !$scope.user.active;
      });
    }
  };

  $scope.toggleUserAdmin = function () {
    if (!$scope.isCurrentUser) {
      var action = $scope.user.admin ?
        $t('users.changePrivilegeConfirmation.revoke') : $t('users.changePrivilegeConfirmation.grant');
      ConfirmationModal.show(
        $t('users.changePrivilegeConfirmation.title'),
        $t('users.changePrivilegeConfirmation.message', {
          action: action,
          userName: $scope.user.user_name
        })
      ).then(function () {
        User.setAdmin($scope.user.user_name, $scope.user.admin)
        .then(function () {
          loadUserInfo();
        })
        .catch(function (data) {
          Alert.error($t('common.alerts.cannotUpdateAdminStatus'), data.data.message);
          $scope.user.admin = !$scope.user.admin;
        });
      })
      .catch(function () {
        $scope.user.admin = !$scope.user.admin;
      });
    }
  };

  $scope.removeViewPrivilege = function (name, privilege) {
    var privilegeObject = {
      id: privilege.privilege_id,
      view_name: privilege.view_name,
      version: privilege.version,
      instance_name: name
    };
    View.deletePrivilege(privilegeObject).then(function () {
      loadUserInfo();
    });
  };

  function deleteUserRoles(clusterName, user, ignoreAlert) {
    return Cluster.deleteMultiplePrivileges(
      clusterName,
      user.roles.map(function(item) {
        return item.privilege_id;
      })
    ).then(function () {
      if (!ignoreAlert) {
        Alert.success($t('users.alerts.roleChangedToNone', {
          user_name: user.user_name
        }));
      }
    }).catch(function (data) {
      Alert.error($t('common.alerts.cannotSavePermissions'), data.data.message);
    });
  }

  function addUserRoles(clusterName, newRole, user) {
    return Cluster.createPrivileges(
      {
        clusterId: clusterName
      },
      [{
        PrivilegeInfo: {
          permission_name: newRole.permission_name,
          principal_name: user.user_name,
          principal_type: 'USER'
        }
      }]
    ).then(function () {
      Alert.success($t('users.alerts.roleChanged', {
        name: user.user_name,
        role: newRole.permission_label
      }));
    }).catch(function (data) {
      Alert.error($t('common.alerts.cannotSavePermissions'), data.data.message);
    });
  }

  function loadUserInfo() {
    return User.getWithRoles($routeParams.id).then(function (data) {
      $scope.user = User.makeUser(data.data).Users;
      $scope.isCurrentUser = $scope.user.user_name === Auth.getCurrentUser();
      $scope.editingGroupsList = angular.copy($scope.user.groups);
      parsePrivileges(data.data.privileges);
      var clusterRole = $scope.user.roles[0];
      $scope.currentRole = clusterRole || nonRole;
      $scope.originalRole = clusterRole || nonRole;
      $scope.dataLoaded = true;
    });
  }

  function parsePrivileges(rawPrivileges) {
    var privileges = {
      clusters: {},
      views: {}
    };
    angular.forEach(rawPrivileges, function (privilege) {
      privilege = privilege.PrivilegeInfo;
      if (privilege.type === 'CLUSTER') {
        // This is cluster
        if (privileges.clusters[privilege.cluster_name]) {
          var preIndex = Cluster.orderedRoles.indexOf(privileges.clusters[privilege.cluster_name].permission_name);
          var curIndex = Cluster.orderedRoles.indexOf(privilege.permission_name);
          // set more powerful role
          if (curIndex < preIndex) {
            privileges.clusters[privilege.cluster_name] = privilege;
          }
        } else {
          privileges.clusters[privilege.cluster_name] = privilege;
        }
      } else if (privilege.type === 'VIEW') {
        privileges.views[privilege.instance_name] = privileges.views[privilege.instance_name] || {
          privileges: [],
          version: privilege.version,
          view_name: privilege.view_name,
          privilege_id: privilege.privilege_id
        };
        if (privileges.views[privilege.instance_name].privileges.indexOf(privilege.permission_label) === -1) {
          privileges.views[privilege.instance_name].privileges.push(privilege.permission_label);
        }
      }
    });

    $scope.privilegesView = privileges;
    $scope.noClusterPriv = $.isEmptyObject(privileges.clusters);
    $scope.noViewPriv = $.isEmptyObject(privileges.views);
    $scope.hidePrivileges = $scope.noClusterPriv && $scope.noViewPriv;
  }

  function loadRoles() {
    return Cluster.getRoleOptions().then(function (data) {
      $scope.roleOptions = data;
    });
  }

  loadRoles().finally(loadUserInfo);

}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('GroupsListCtrl',
['$scope', 'Group', '$modal', 'ConfirmationModal', '$rootScope', '$translate', 'Settings', 'Cluster', 'View', 'Alert', 'Pagination', 'Filters',
function($scope, Group, $modal, ConfirmationModal, $rootScope, $translate, Settings, Cluster, View, Alert, Pagination, Filters) {
  var $t = $translate.instant;
  $scope.constants = {
    groups: $t('common.groups').toLowerCase()
  };
  $scope.minRowsToShowPagination = Settings.minRowsToShowPagination;
  $scope.isLoading = false;
  $scope.groups = [];
  $scope.tableInfo = {
    filtered: 0,
    total: 0,
    showed: 0
  };
  $scope.pagination = Pagination.create();
  $scope.filters = [
    {
      key: 'group_name',
      label: $t('groups.name'),
      options: []
    },
    {
      key: 'groupTypeName',
      label: $t('common.type'),
      options: []
    }
  ];

  $scope.resetPagination = function() {
    $scope.pagination.resetPagination($scope.groups, $scope.tableInfo);
  };

  $scope.pageChanged = function() {
    $scope.pagination.pageChanged($scope.groups, $scope.tableInfo);
  };

  $scope.filterGroups = function(appliedFilters) {
    $scope.tableInfo.filtered = Filters.filterItems(appliedFilters, $scope.groups, $scope.filters);
    $scope.pagination.resetPagination($scope.groups, $scope.tableInfo);
  };

  $scope.toggleSearchBox = function() {
    $('.search-box-button .popup-arrow-up, .search-box-row').toggleClass('hide');
  };

  $scope.loadGroups = function() {
    $scope.isLoading = true;
    Group.all().then(function(groups) {
      $scope.isLoading = false;
      $scope.groups = groups.map(Group.makeGroup);
      $scope.tableInfo.total = $scope.groups.length;
      Filters.initFilterOptions($scope.filters, $scope.groups);
      $scope.filterGroups();
    })
    .catch(function(data) {
      Alert.error($t('groups.alerts.getGroupsListError'), data.data.message);
    });
  };

  $scope.loadGroups();

  $rootScope.$watch(function(scope) {
    return scope.LDAPSynced;
  }, function(LDAPSynced) {
    if(LDAPSynced === true){
      $rootScope.LDAPSynced = false;
      $scope.loadGroups();
    }
  });

  $scope.createGroup = function () {
    var modalInstance = $modal.open({
      templateUrl: 'views/userManagement/modals/groupCreate.html',
      controller: 'GroupCreateCtrl',
      backdrop: 'static'
    });

    modalInstance.result.finally($scope.loadGroups);
  };

  $scope.deleteGroup = function(group) {
    ConfirmationModal.show(
      $t('common.delete', {
        term: $t('common.group')
      }),
      $t('common.deleteConfirmation', {
        instanceType: $t('common.group').toLowerCase(),
        instanceName: '"' + group.group_name + '"'
      }),
      null,
      null,
      {primaryClass: 'btn-danger'}
    ).then(function() {
      Cluster.getPrivilegesForResource({
        nameFilter : group.group_name,
        typeFilter : {value: 'GROUP'}
      }).then(function(data) {
        var clusterPrivilegesIds = [];
        var viewsPrivileges = [];
        if (data.items && data.items.length) {
          angular.forEach(data.items[0].privileges, function(privilege) {
            if (privilege.PrivilegeInfo.principal_type === 'GROUP') {
              if (privilege.PrivilegeInfo.type === 'VIEW') {
                viewsPrivileges.push({
                  id: privilege.PrivilegeInfo.privilege_id,
                  view_name: privilege.PrivilegeInfo.view_name,
                  version: privilege.PrivilegeInfo.version,
                  instance_name: privilege.PrivilegeInfo.instance_name
                });
              } else {
                clusterPrivilegesIds.push(privilege.PrivilegeInfo.privilege_id);
              }
            }
          });
        }
        group.destroy().then(function() {
          if (clusterPrivilegesIds.length) {
            Cluster.deleteMultiplePrivileges($rootScope.cluster.Clusters.cluster_name, clusterPrivilegesIds);
          }
          angular.forEach(viewsPrivileges, function(privilege) {
            View.deletePrivilege(privilege);
          });
          $scope.loadGroups();
        });
      });
    });
  };

}]);
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('GroupCreateCtrl',
['$scope', '$rootScope', 'Group', '$location', 'Alert', 'UnsavedDialog', '$translate', '$modalInstance', 'Cluster', 'RoleDetailsModal', '$q',
function($scope, $rootScope, Group, $location, Alert, UnsavedDialog, $translate, $modalInstance, Cluster, RoleDetailsModal, $q) {
  var $t = $translate.instant;

  $scope.form = {};
  $scope.formData = {
    groupName: '',
    members: [],
    role: ''
  };
  $scope.roleOptions = [];


  function loadRoles() {
    return Cluster.getRoleOptions().then(function (data) {
      $scope.roleOptions = data;
    });
  }

  function unsavedChangesCheck() {
    if ($scope.form.groupCreateForm.$dirty) {
      UnsavedDialog().then(function (action) {
        switch (action) {
          case 'save':
            $scope.save();
            break;
          case 'discard':
            $modalInstance.close('discard');
            break;
          case 'cancel':
            break;
        }
      });
    } else {
      $modalInstance.close('discard');
    }
  }

  function saveMembers(group, members) {
    if (!members.length) {
      return;
    }
    group.members = members.filter(function(item) {
      return item.trim();
    }).map(function(item) {
      return item.trim();
    });
    return group.saveMembers().catch(function(resp) {
      Alert.error($t('groups.alerts.cannotUpdateGroupMembers'), "<div class='break-word'>" + resp.data.message + "</div>");
    });
  }

  $scope.showHelpPage = function() {
    Cluster.getRolesWithAuthorizations().then(function(roles) {
      RoleDetailsModal.show(roles);
    });
  };

  $scope.save = function () {
    $scope.form.groupCreateForm.submitted = true;
    if ($scope.form.groupCreateForm.$valid) {
      var group = new Group($scope.formData.groupName);
      group.save().then(function () {
        $q.all([
          saveMembers(group, $scope.formData.members),
          saveRole()
        ]).then(function (value) {
          $modalInstance.dismiss('created');
          Alert.success($t('groups.alerts.groupCreated', {groupName: $scope.formData.groupName}));
        });
      })
      .catch(function (data) {
        Alert.error($t('groups.alerts.groupCreationError'), data.data.message);
      });
    }
  };

  function saveRole() {
    if (!$scope.formData.role || $scope.formData.role === 'NONE') {
      return;
    }
    return Cluster.createPrivileges(
      {
        clusterId: $rootScope.cluster.Clusters.cluster_name
      },
      [{PrivilegeInfo: {
        permission_name: $scope.formData.role,
        principal_name: $scope.formData.groupName,
        principal_type: 'GROUP'
      }}]
    )
    .catch(function(data) {
      Alert.error($t('common.alerts.cannotSavePermissions'), data.data.message);
    });
  }

  $scope.cancel = function () {
    unsavedChangesCheck();
  };

  loadRoles();
}]);
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('GroupEditCtrl',
['$scope', '$rootScope', 'Group', '$routeParams', 'Cluster', 'View', 'Alert', 'ConfirmationModal', '$location', '$translate', 'RoleDetailsModal',
function($scope, $rootScope, Group, $routeParams, Cluster, View, Alert, ConfirmationModal, $location,  $translate, RoleDetailsModal) {
  var $t = $translate.instant;
  var nonRole = {
    permission_name: 'NONE',
    permission_label: $t('users.roles.none')
  };

  $scope.constants = {
    group: $t('common.group'),
    view: $t('common.view').toLowerCase(),
    cluster: $t('common.cluster').toLowerCase()
  };
  $scope.editMode = false;
  $scope.group = new Group($routeParams.id);
  $scope.group.editingUsers = [];
  $scope.groupMembers = [];
  $scope.dataLoaded = false;
  $scope.isMembersEditing = false;

  $scope.$watch(function() {
    return $scope.group.editingUsers;
  }, function(newValue) {
    if(newValue && !angular.equals(newValue, $scope.groupMembers)){
      $scope.updateMembers();  
    }
  }, true);
  
  $scope.enableMembersEditing = function() {
    $scope.isMembersEditing = true;
    $scope.group.editingUsers = angular.copy($scope.groupMembers);
  };
  $scope.cancelUpdate = function() {
    $scope.isMembersEditing = false;
    $scope.group.editingUsers = '';
  };
  $scope.updateMembers = function() {
    var newMembers = $scope.group.editingUsers.toString().split(',').filter(function(item) {
      return item.trim();}
    ).map(function(item) {
        return item.trim()
      }
    );
    $scope.group.members = newMembers;
    $scope.group.saveMembers().catch(function(resp) {
        Alert.error($t('groups.alerts.cannotUpdateGroupMembers'), "<div class='break-word'>" + resp.data.message + "</div>");
      }).finally(function() {
        loadGroup();
      });
    $scope.isMembersEditing = false;
  };

  $scope.removeViewPrivilege = function(name, privilege) {
    var privilegeObject = {
        id: privilege.privilege_id,
        view_name: privilege.view_name,
        version: privilege.version,
        instance_name: name
    };
    View.deletePrivilege(privilegeObject).then(function() {
      loadGroup();
    });
  };

  $scope.showHelpPage = function() {
    Cluster.getRolesWithAuthorizations().then(function(roles) {
      RoleDetailsModal.show(roles);
    });
  };

  $scope.updateRole = function () {
    var clusterName = $rootScope.cluster.Clusters.cluster_name;
    if ($scope.originalRole.permission_name !== $scope.currentRole.permission_name) {
      if ($scope.currentRole.permission_name === 'NONE') {
        deleteGroupRoles(clusterName, $scope.group).finally(loadGroup);
      } else {
        if ($scope.group.roles.length) {
          deleteGroupRoles(clusterName, $scope.group, true).finally(function() {
            addGroupRoles(clusterName, $scope.currentRole, $scope.group).finally(loadGroup);
          });
        } else {
          addGroupRoles(clusterName, $scope.currentRole, $scope.group).finally(loadGroup);
        }
      }
    }
  };

  function deleteGroupRoles(clusterName, group, ignoreAlert) {
    return Cluster.deleteMultiplePrivileges(
      clusterName,
      group.roles.map(function(item) {
        return item.privilege_id;
      })
    ).then(function () {
      if (!ignoreAlert) {
        Alert.success($t('users.alerts.roleChangedToNone', {
          user_name: group.group_name
        }));
      }
    }).catch(function (data) {
      Alert.error($t('common.alerts.cannotSavePermissions'), data.data.message);
    });
  }

  function addGroupRoles(clusterName, newRole, group) {
    return Cluster.createPrivileges(
      {
        clusterId: clusterName
      },
      [{
        PrivilegeInfo: {
          permission_name: newRole.permission_name,
          principal_name: group.group_name,
          principal_type: 'GROUP'
        }
      }]
    ).then(function () {
      Alert.success($t('users.alerts.roleChanged', {
        name: group.group_name,
        role: newRole.permission_label
      }));
    }).catch(function (data) {
      Alert.error($t('common.alerts.cannotSavePermissions'), data.data.message);
    });
  }

  function parsePrivileges(rawPrivileges) {
    var privileges = {
      clusters: {},
      views: {}
    };
    angular.forEach(rawPrivileges, function (privilege) {
      privilege = privilege.PrivilegeInfo;
      if (privilege.type === 'CLUSTER') {
        // This is cluster
        privileges.clusters[privilege.cluster_name] = privileges.clusters[privilege.cluster_name] || [];
        privileges.clusters[privilege.cluster_name].push(privilege.permission_label);
      } else if (privilege.type === 'VIEW') {
        privileges.views[privilege.instance_name] = privileges.views[privilege.instance_name] || {
          privileges: [],
          version: privilege.version,
          view_name: privilege.view_name,
          privilege_id: privilege.privilege_id
        };
        if (privileges.views[privilege.instance_name].privileges.indexOf(privilege.permission_label) === -1) {
          privileges.views[privilege.instance_name].privileges.push(privilege.permission_label);
        }
      }
    });

    $scope.privileges = privileges;
    $scope.noClusterPriv = $.isEmptyObject(privileges.clusters);
    $scope.noViewPriv = $.isEmptyObject(privileges.views);
    $scope.hidePrivileges = $scope.noClusterPriv && $scope.noViewPriv;
  }

  function loadGroup() {
    Group.get($routeParams.id).then(function(group) {
      $scope.group = group;
      parsePrivileges(group.privileges);
      var clusterRole = $scope.group.roles[0];
      $scope.currentRole = clusterRole || nonRole;
      $scope.originalRole = clusterRole || nonRole;
      $scope.groupMembers = group.members.map(function(item) {
        return item.MemberInfo.user_name;
      });
      $scope.group.editingUsers = angular.copy($scope.groupMembers);
    }).finally(function() {
      $scope.dataLoaded = true;
    });
  }

  function loadRoles() {
    return Cluster.getRoleOptions().then(function(data) {
      $scope.roleOptions = data;
    });
  }

  loadRoles().finally(loadGroup);

}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('ViewsListCtrl',
['$scope', 'View','$modal', 'Alert', 'ConfirmationModal', '$translate', 'Settings', 'Pagination', 'Filters',
function($scope, View, $modal, Alert, ConfirmationModal, $translate, Settings, Pagination, Filters) {
  var $t = $translate.instant;
  var VIEWS_VERSION_STATUS_TIMEOUT = 5000;
  $scope.isLoading = false;
  $scope.minInstanceForPagination = Settings.minRowsToShowPagination;

  $scope.filters = [
    {
      key: 'short_url_name',
      label: $t('common.name'),
      options: []
    },
    {
      key: 'url',
      label: $t('urls.url'),
      customValueConverter: function(item) {
        return '/main/view/' + item.view_name + '/' + item.short_url;
      },
      options: []
    },
    {
      key: 'view_name',
      label: $t('views.table.viewType'),
      options: []
    },
    {
      key: 'instance_name',
      label: $t('urls.viewInstance'),
      options: []
    }
  ];
  $scope.views = [];
  $scope.instances = [];
  $scope.tableInfo = {
    filtered: 0,
    showed: 0,
    total: 0
  };
  $scope.pagination = Pagination.create();

  $scope.resetPagination = function() {
    $scope.pagination.resetPagination($scope.instances, $scope.tableInfo);
  };

  $scope.pageChanged = function() {
    $scope.pagination.pageChanged($scope.instances, $scope.tableInfo);
  };

  $scope.filterInstances = function(appliedFilters) {
    $scope.tableInfo.filtered = Filters.filterItems(appliedFilters, $scope.instances, $scope.filters);
    $scope.pagination.resetPagination($scope.instances, $scope.tableInfo);
  };

  $scope.toggleSearchBox = function() {
    $('.search-box-button .popup-arrow-up, .search-box-row').toggleClass('hide');
  };

  $scope.cloneInstance = function(instanceClone) {
    $scope.createInstance(instanceClone);
  };

  $scope.createInstance = function (instanceClone) {
    var modalInstance = $modal.open({
      templateUrl: 'views/ambariViews/modals/create.html',
      controller: 'CreateViewInstanceCtrl',
      resolve: {
        views: function() {
          return $scope.views;
        },
        instanceClone: function() {
          return instanceClone;
        }
      },
      backdrop: 'static'
    });

    modalInstance.result.then(loadViews);
  };

  $scope.deleteInstance = function (instance) {
    ConfirmationModal.show(
      $t('common.delete', {
        term: $t('views.viewInstance')
      }),
      $t('common.deleteConfirmation', {
        instanceType: $t('views.viewInstance'),
        instanceName: instance.label
      }),
      null,
      null,
      {
        primaryClass: 'btn-danger'
      }
    ).then(function () {
      View.deleteInstance(instance.view_name, instance.version, instance.instance_name)
        .then(function () {
          loadViews();
        })
        .catch(function (data) {
          Alert.error($t('views.alerts.cannotDeleteInstance'), data.data.message);
        });
    });
  };

  loadViews();

  function checkViewVersionStatus(view, versionObj, versionNumber) {
    var deferred = View.checkViewVersionStatus(view.view_name, versionNumber);

    deferred.promise.then(function (status) {
      if (versionNeedStatusUpdate(status)) {
        setTimeout(function() {
          checkViewVersionStatus(view, versionObj, versionNumber);
        }, VIEWS_VERSION_STATUS_TIMEOUT);
      } else {
        versionObj.status = status;
        angular.forEach(view.versions, function (version) {
          if (version.status === 'DEPLOYED') {
            view.canCreateInstance = true;
          }
        })
      }
    });
  }

  function versionNeedStatusUpdate(status) {
    return status !== 'DEPLOYED' && status !== 'ERROR';
  }

  function loadViews() {
    $scope.isLoading = true;
    View.all().then(function (views) {
      $scope.isLoading = false;
      $scope.views = views;
      $scope.instances = [];
      angular.forEach(views, function (view) {
        angular.forEach(view.versions, function (versionObj, versionNumber) {
          if (versionNeedStatusUpdate(versionObj.status)) {
            checkViewVersionStatus(view, versionObj, versionNumber);
          }
        });
        angular.forEach(view.instances, function (instance) {
          instance.ViewInstanceInfo.short_url_name = instance.ViewInstanceInfo.short_url_name || '';
          instance.ViewInstanceInfo.short_url = instance.ViewInstanceInfo.short_url || '';
          instance.ViewInstanceInfo.versionObj = view.versions[instance.ViewInstanceInfo.version] || {};
          $scope.instances.push(instance.ViewInstanceInfo);
        });
      });
      $scope.tableInfo.total = $scope.instances.length;
      Filters.initFilterOptions($scope.filters, $scope.instances);
      $scope.filterInstances();
    }).catch(function (data) {
      Alert.error($t('views.alerts.cannotLoadViews'), data.data.message);
    });
  }

}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
  .controller('ViewsEditCtrl', ['$scope','$route', '$templateCache', '$routeParams', 'RemoteCluster', 'Cluster', 'View', 'Alert', 'PermissionLoader', 'PermissionSaver', 'ConfirmationModal', '$location', 'UnsavedDialog', '$translate', function($scope, $route, $templateCache , $routeParams, RemoteCluster, Cluster, View, Alert, PermissionLoader, PermissionSaver, ConfirmationModal, $location, UnsavedDialog, $translate) {
    var $t = $translate.instant;
    $scope.identity = angular.identity;
    $scope.isConfigurationEmpty = true;
    $scope.isSettingsEmpty = true;
    $scope.permissionRoles = View.permissionRoles;
    $scope.constants = {
      instance: $t('views.instance'),
      props: $t('views.properties'),
      perms: $t('views.permissions').toLowerCase()
    };

    function reloadViewInfo(section){
      // Load instance data, after View permissions meta loaded
      View.getInstance($routeParams.viewId, $routeParams.version, $routeParams.instanceId)
        .then(function(instance) {
          $scope.instance = instance;
          $scope.viewUrl = instance.ViewInstanceInfo.view_name + '/' + instance.ViewInstanceInfo.version + '/' + instance.ViewInstanceInfo.instance_name;
          $scope.settings = {
            'visible': $scope.instance.ViewInstanceInfo.visible,
            'label': $scope.instance.ViewInstanceInfo.label,
            'description': $scope.instance.ViewInstanceInfo.description,
            'shortUrl': $scope.instance.ViewInstanceInfo.short_url,
            'shortUrlName': $scope.instance.ViewInstanceInfo.short_url_name
          };
          switch (section) {
            case "details" :
              initConfigurations();
              initCtrlVariables(instance);
              break;
            case "settings" :
              initConfigurations(true);
              break;
            case "cluster" :
              initCtrlVariables(instance);
              break;
          }
        }, function(data) {
          Alert.error($t('views.alerts.cannotLoadInstanceInfo'), data.data.message);
        });
    }

    function initCtrlVariables(instance) {
       $scope.data.clusterType = instance.ViewInstanceInfo.cluster_type;
       var clusterId = instance.ViewInstanceInfo.cluster_handle;
       if (!clusterId) $scope.data.clusterType = 'NONE';
       switch($scope.data.clusterType) {
          case 'LOCAL_AMBARI':
            $scope.clusters.forEach(function(cluster){
              if(cluster.id == clusterId){
                $scope.cluster = cluster;
              }
            })
            break;
          case 'REMOTE_AMBARI':
            $scope.data.remoteCluster = null;
            $scope.remoteClusters.forEach(function(cluster){
              if(cluster.id == clusterId){
                $scope.data.remoteCluster = cluster;
              }
            })
            break;
       }

      $scope.originalClusterType = $scope.data.clusterType;
      $scope.isConfigurationEmpty = !$scope.numberOfClusterConfigs;
      $scope.isSettingsEmpty = !$scope.numberOfSettingsConfigs;
    }

    function isClusterConfig(name) {
      var configurationMeta = $scope.configurationMeta;
      var clusterConfigs = configurationMeta.filter(function(el) {
        return el.clusterConfig;
      }).map(function(el) {
        return el.name;
      });
      return clusterConfigs.indexOf(name) !== -1;
    }

    function initConfigurations(initClusterConfig) {
      var initAllConfigs = !initClusterConfig;
      var configuration = angular.copy($scope.instance.ViewInstanceInfo.properties);
      if (initAllConfigs) {
        $scope.configuration = angular.copy($scope.instance.ViewInstanceInfo.properties);
      }
      for (var confName in configuration) {
        if (configuration.hasOwnProperty(confName)) {
          if (!isClusterConfig(confName) || initAllConfigs) {
            $scope.configuration[confName] = configuration[confName] === 'null' ? '' : configuration[confName];
          }
        }
      }
    }

    function filterClusterConfigs() {
      $scope.configurationMeta.forEach(function (element) {
        if (element.masked && !$scope.editConfigurationDisabled && element.clusterConfig && $scope.data.clusterType == 'NONE') {
          $scope.configuration[element.name] = '';
        }
        if(!element.clusterConfig) {
          delete $scope.configurationBeforeEdit[element.name];
        }
      });
    }

    // Get META for properties
    View.getMeta($routeParams.viewId, $routeParams.version).then(function(data) {
      $scope.configurationMeta = data.data.ViewVersionInfo.parameters;
      $scope.clusterConfigurable = data.data.ViewVersionInfo.cluster_configurable;
      $scope.clusterConfigurableErrorMsg = $scope.clusterConfigurable ? "" : $t('views.alerts.cannotUseOption');
      angular.forEach($scope.configurationMeta, function (item) {
        item.displayName = item.name.replace(/\./g, '\.\u200B');
        item.clusterConfig = !!item.clusterConfig;
        if (!item.clusterConfig) {
          $scope.numberOfSettingsConfigs++;
        }
        $scope.numberOfClusterConfigs = $scope.numberOfClusterConfigs + !!item.clusterConfig;
      });
      reloadViewInfo("details");
    });

    function reloadViewPrivileges(){
      PermissionLoader.getViewPermissions({
          viewName: $routeParams.viewId,
          version: $routeParams.version,
          instanceId: $routeParams.instanceId
        })
        .then(function(permissions) {
          // Refresh data for rendering
          $scope.permissionsEdit = permissions;
          $scope.permissions = angular.copy(permissions);
          $scope.isPermissionsEmpty = angular.equals({}, $scope.permissions);
        }, function(data) {
          Alert.error($t('views.alerts.cannotLoadPermissions'), data.data.message);
        });
    }

    $scope.permissions = [];

    reloadViewPrivileges();

    $scope.clusterConfigurable = false;
    $scope.clusterConfigurableErrorMsg = "";
    $scope.clusters = [];
    $scope.remoteClusters = [];
    $scope.cluster = null;
    $scope.noLocalClusterAvailible = true;
    $scope.noRemoteClusterAvailible = true;
    $scope.data = {};
    $scope.data.remoteCluster = null;
    $scope.data.clusterType = 'NONE';

    $scope.editSettingsDisabled = true;
    $scope.editDetailsSettingsDisabled = true;
    $scope.numberOfClusterConfigs = 0;
    $scope.numberOfSettingsConfigs = 0;

    $scope.enableLocalCluster = function() {
      angular.extend($scope.configuration, $scope.configurationBeforeEdit);
      $scope.propertiesForm.$setPristine();
    };

    $scope.disableLocalCluster = function() {
      filterClusterConfigs();
    };

    $scope.toggleSettingsEdit = function() {
      $scope.editSettingsDisabled = !$scope.editSettingsDisabled;
      $scope.settingsBeforeEdit = angular.copy($scope.configuration);
      $scope.configurationMeta.forEach(function (element) {
        if (element.masked && !$scope.editSettingsDisabled && !element.clusterConfig) {
          $scope.configuration[element.name] = '';
        }
        if(element.clusterConfig) {
          delete $scope.settingsBeforeEdit[element.name];
        }
      });
    };

    $scope.toggleDetailsSettingsEdit = function() {
      $scope.editDetailsSettingsDisabled = !$scope.editDetailsSettingsDisabled;
      $scope.settingsBeforeEdit = angular.copy($scope.configuration);
      $scope.configurationMeta.forEach(function (element) {
        if (element.masked && !$scope.editDetailsSettingsDisabled && !element.clusterConfig) {
          $scope.configuration[element.name] = '';
        }
        if(element.clusterConfig) {
          delete $scope.settingsBeforeEdit[element.name];
        }
      });
    };

    Cluster.getAllClusters().then(function (clusters) {
      if(clusters.length >0){
        clusters.forEach(function(cluster) {
          $scope.clusters.push({
            "name" : cluster.Clusters.cluster_name,
            "id" : cluster.Clusters.cluster_id
          })
        });
        $scope.noLocalClusterAvailible = false;
      }else{
        $scope.clusters.push($t('common.noClusters'));
      }
      $scope.cluster = $scope.clusters[0];
    });

    loadRemoteClusters();

    function loadRemoteClusters() {
      RemoteCluster.listAll().then(function (clusters) {
        if(clusters.length >0){
          clusters.forEach(function(cluster) {
            $scope.remoteClusters.push({
              "name" : cluster.ClusterInfo.name,
              "id" : cluster.ClusterInfo.cluster_id
            })
          });
          $scope.noRemoteClusterAvailible = false;
          }else{
            $scope.remoteClusters.push($t('common.noClusters'));
          }
          $scope.data.remoteCluster = $scope.remoteClusters[0];
       });
     }


    $scope.saveSettings = function(callback) {
      if( $scope.settingsForm.$valid ){
        var data = {
          'ViewInstanceInfo':{
            'properties':{}
          }
        };
        $scope.configurationMeta.forEach(function (element) {
          if(!element.clusterConfig) {
            data.ViewInstanceInfo.properties[element.name] = $scope.configuration[element.name];
          }
        });
        return View.updateInstance($routeParams.viewId, $routeParams.version, $routeParams.instanceId, data).then(
          function() {
            if( callback ){
              callback();
            } else {
              reloadViewInfo("settings");
              $scope.editSettingsDisabled = true;
              $scope.settingsForm.$setPristine();
            }
          }, function(data) {
            Alert.error($t('views.alerts.cannotSaveSettings'), data.data.message);
          }
        );
      }
    };
    $scope.cancelSettings = function() {
      angular.extend($scope.configuration, $scope.settingsBeforeEdit);

      $scope.editSettingsDisabled = true;
      $scope.settingsForm.$setPristine();
    };

    $scope.saveDetails = function(callback) {
      if( $scope.detailsForm.$valid ){
        var data = {
          'ViewInstanceInfo':{
            'visible': $scope.settings.visible,
            'label': $scope.settings.label,
            'description': $scope.settings.description
          }
        };
        return View.updateInstance($routeParams.viewId, $routeParams.version, $routeParams.instanceId, data).then(
          function() {
            $scope.$root.$emit('instancesUpdate');
            if( callback ){
              callback();
            } else {
              reloadViewInfo("cluster");
              $scope.editDetailsSettingsDisabled = true;
              $scope.settingsForm.$setPristine();
            }
          },  function(data) {
            Alert.error($t('views.alerts.cannotSaveSettings'), data.data.message);
          }
        );
      }
    };
    $scope.cancelDetails = function() {
      $scope.settings = {
        'visible': $scope.instance.ViewInstanceInfo.visible,
        'label': $scope.instance.ViewInstanceInfo.label,
        'description': $scope.instance.ViewInstanceInfo.description,
        'shortUrl': $scope.instance.ViewInstanceInfo.short_url,
        'shortUrlName': $scope.instance.ViewInstanceInfo.short_url_name
      };
      $scope.editDetailsSettingsDisabled = true;
      $scope.settingsForm.$setPristine();
    };


    $scope.editConfigurationDisabled = true;
    $scope.togglePropertiesEditing = function () {
      $scope.editConfigurationDisabled = !$scope.editConfigurationDisabled;
      $scope.configurationBeforeEdit = angular.copy($scope.configuration);
      filterClusterConfigs();
    };
    $scope.saveConfiguration = function() {
      if( $scope.propertiesForm.$valid ){
        var data = {
          'ViewInstanceInfo':{
            'properties':{}
          }
        };

        data.ViewInstanceInfo.cluster_type = $scope.data.clusterType;

        switch($scope.data.clusterType) {
          case 'LOCAL_AMBARI':
            data.ViewInstanceInfo.cluster_handle = $scope.cluster.id;
            break;
          case 'REMOTE_AMBARI':
            data.ViewInstanceInfo.cluster_handle = $scope.data.remoteCluster.id;
            break;
            break;
          default :
            data.ViewInstanceInfo.cluster_handle = null;
            $scope.configurationMeta.forEach(function (element) {
              if(element.clusterConfig) {
                data.ViewInstanceInfo.properties[element.name] = $scope.configuration[element.name];
              }
            });
            $scope.removeAllRolePermissions();

          }

        $scope.originalClusterType = $scope.data.clusterType;
        return View.updateInstance($routeParams.viewId, $routeParams.version, $routeParams.instanceId, data).then(
          function() {
            $scope.editConfigurationDisabled = true;
            $scope.propertiesForm.$setPristine();
          }, function(data) {
            var errorMessage = data.data.message;

            //TODO: maybe the BackEnd should sanitize the string beforehand?
            errorMessage = errorMessage.substr(errorMessage.indexOf("\{"));

            if (data.status >= 400 && $scope.data.clusterType == 'NONE') {
              try {
                var errorObject = JSON.parse(errorMessage);
                errorMessage = errorObject.detail;
                angular.forEach(errorObject.propertyResults, function (item, key) {
                  $scope.propertiesForm[key].validationError = !item.valid;
                  if (!item.valid) {
                    $scope.propertiesForm[key].validationMessage = item.detail;
                  }
                });
              } catch (e) {
                console.error($t('views.alerts.unableToParseError', {message: data.message}));
              }
            }
            Alert.error($t('views.alerts.cannotSaveProperties'), errorMessage);
          }
        );
      }
    };
    $scope.cancelConfiguration = function() {
      angular.extend($scope.configuration, $scope.configurationBeforeEdit);
      $scope.data.clusterType = $scope.originalClusterType;
      $scope.editConfigurationDisabled = true;
      $scope.propertiesForm.$setPristine();
    };

    // Permissions edit
    $scope.editPermissionDisabled = true;
    $scope.cancelPermissions = function() {
      $scope.permissionsEdit = angular.copy($scope.permissions); // Reset textedit areaes
      $scope.editPermissionDisabled = true;
    };

    $scope.savePermissions = function() {
      $scope.editPermissionDisabled = true;
      return PermissionSaver.saveViewPermissions(
        $scope.permissionsEdit,
        {
          view_name: $routeParams.viewId,
          version: $routeParams.version,
          instance_name: $routeParams.instanceId
        }
        )
        .then(reloadViewPrivileges, function(data) {
          reloadViewPrivileges();
          Alert.error($t('common.alerts.cannotSavePermissions'), data.data.message);
        });
    };

    $scope.removeAllRolePermissions = function() {
      angular.forEach(View.permissionRoles, function(key) {
        $scope.permissionsEdit["VIEW.USER"]["ROLE"][key] = false;
      })
    };

    $scope.$watch(function() {
      return $scope.permissionsEdit;
    }, function(newValue, oldValue) {
      if(newValue && oldValue != undefined) {
        $scope.savePermissions();
      }
    }, true);



    $scope.deleteInstance = function(instance) {
      ConfirmationModal.show(
        $t('common.delete', {
          term: $t('views.viewInstance')
        }),
        $t('common.deleteConfirmation', {
          instanceType: $t('views.viewInstance'),
          instanceName: instance.ViewInstanceInfo.label
        }),
        null,
        null,
        {
          primaryClass: 'btn-danger'
        }
      ).then(function() {
        View.deleteInstance(instance.ViewInstanceInfo.view_name, instance.ViewInstanceInfo.version, instance.ViewInstanceInfo.instance_name)
          .then(function() {
            $location.path('/views');
          }, function(data) {
            Alert.error($t('views.alerts.cannotDeleteInstance'), data.data.message);
          });
      });
    };

    $scope.deleteShortURL = function(shortUrlName) {
      ConfirmationModal.show(
        $t('common.delete', {
          term: $t('urls.url')
        }),
        $t('common.deleteConfirmation', {
          instanceType: $t('urls.url').toLowerCase(),
          instanceName: '"' + shortUrlName + '"'
        })
      ).then(function() {
        View.deleteUrl(shortUrlName).then(function() {
          var currentPageTemplate = $route.current.templateUrl;
          $templateCache.remove(currentPageTemplate);
          $route.reload();
        });
      });
    };

    $scope.$on('$locationChangeStart', function(event, targetUrl) {
      if( $scope.settingsForm.$dirty || $scope.propertiesForm.$dirty){
        UnsavedDialog().then(function(action) {
          targetUrl = targetUrl.split('#').pop();
          switch(action){
            case 'save':
              if($scope.settingsForm.$valid &&  $scope.propertiesForm.$valid ){
                $scope.saveSettings(function() {
                  $scope.saveConfiguration().then(function() {
                    $scope.propertiesForm.$setPristine();
                    $scope.settingsForm.$setPristine();
                    $location.path(targetUrl);
                  });
                });
              }
              break;
            case 'discard':
              $scope.propertiesForm.$setPristine();
              $scope.settingsForm.$setPristine();
              $location.path(targetUrl);
              break;
            case 'cancel':
              targetUrl = '';
              break;
          }
        });
        event.preventDefault();
      }
    });

    $scope.checkAllRoles = function () {
      setAllViewRoles(true);
    };

    $scope.clearAllRoles = function () {
      setAllViewRoles(false);
    };

    function setAllViewRoles(value) {
      var viewRoles = $scope.permissionsEdit["VIEW.USER"]["ROLE"];
      for (var role in viewRoles) {
        $scope.permissionsEdit["VIEW.USER"]["ROLE"][role] = value;
      }
    }
  }]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('ViewUrlCtrl',['$scope', 'View', 'Alert', 'Cluster', '$routeParams', '$location', 'UnsavedDialog', '$translate', 'Settings', function($scope, View, Alert, Cluster, $routeParams, $location, UnsavedDialog, $translate, Settings) {
  var $t = $translate.instant;
  $scope.form = {};
  $scope.constants = {
    props: $t('views.properties')
  };
  var targetUrl = '/viewUrls';

  $scope.url={};
  $scope.formHolder = {};
  $scope.stepOneNotCompleted = true;
  $scope.stepTwoNotCompleted = true;

  View.getAllVisibleInstance().then(function(views) {
    var names = [];
    var instances=[];
    views.map(function(view){
      var nameVersion = view.view_name+" {"+view.version+"}";
        names.push(nameVersion);
      instances.push({nameV:nameVersion,instance:view.instance_name,cname:view.view_name,version:view.version});
    });

    var output = [],
        keys = [];

    angular.forEach(names, function(item) {
      var key = item;
      if(keys.indexOf(key) === -1) {
        keys.push(key);
        output.push(item);
      }
    });

    $scope.viewsVersions =  output;
    $scope.viewInstances =  instances;

    if($routeParams.viewName && $routeParams.viewVersion && $routeParams.viewInstanceName){
      var selectedView = $routeParams.viewName+" {"+$routeParams.viewVersion+"}";
      $scope.url.selectedView = selectedView;
      $scope.url.selectedInstance = instances.find(function(inst){
         return inst.nameV === selectedView && inst.instance === $routeParams.viewInstanceName && inst.version === $routeParams.viewVersion && inst.cname === $routeParams.viewName;
      });
      $scope.stepOneNotCompleted = false;
      $scope.stepTwoNotCompleted = false;
    }

  }).catch(function(data) {
    Alert.error($t('views.alerts.cannotLoadViews'), data.data.message);
  });

  $scope.filterByName = function(nameV){
    return function (item) {
      if (item.nameV === nameV)
      {
        return true;
      }
      return false;
    };
  };

  $scope.chomp = function(viewNameVersion){
    if(viewNameVersion) {
      return viewNameVersion.substr(0, viewNameVersion.indexOf("{")).trim();
    }
  };


  $scope.doStepOne = function () {
    $scope.stepOneNotCompleted = false;
  };


  $scope.doStepTwo = function () {
    $scope.stepTwoNotCompleted = false;

  };

  $scope.cancelForm = function () {
    $scope.stepOneNotCompleted = true;
    $scope.stepTwoNotCompleted = true;
  };

  $scope.saveUrl = function() {
    $scope.formHolder.form.submitted = true;

    if($scope.formHolder.form.$valid){

      var payload = {ViewUrlInfo:{
        url_name:$scope.url.urlName,
        url_suffix:$scope.url.suffix,
        view_instance_version:$scope.url.selectedInstance.version,
        view_instance_name:$scope.url.selectedInstance.instance,
        view_instance_common_name:$scope.url.selectedInstance.cname
      }};

      View.updateShortUrl(payload).then(function(urlStatus) {
        Alert.success($t('urls.urlCreated', {
          siteRoot: Settings.siteRoot,
          viewName:$scope.url.selectedInstance.cname ,
          shortUrl:$scope.url.suffix,
          urlName:$scope.url.urlName
        }));
        $scope.formHolder.form.$setPristine();
        $scope.url={};
        $scope.formHolder = {};
        $scope.stepOneNotCompleted = true;
        $scope.stepTwoNotCompleted = true;
        $location.path(targetUrl);
      }).catch(function(resp) {
        Alert.error($t('views.alerts.cannotLoadViewUrls'), resp.data.message);
      });

    }
  };

}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
  .controller('ViewUrlEditCtrl',['$scope', 'View', 'Alert', 'Cluster', '$routeParams', '$location', 'UnsavedDialog', '$translate','ConfirmationModal', 'Settings' ,function($scope, View, Alert, Cluster, $routeParams, $location, UnsavedDialog, $translate,ConfirmationModal, Settings) {
  var $t = $translate.instant;
  $scope.form = {};
  $scope.constants = {
    props: $t('views.properties')
  };
  var targetUrl = '/viewUrls';


  function setUpEdit(){

      View.getUrlInfo($routeParams.urlName).then(function(url) {
        $scope.url = url.ViewUrlInfo;
        $scope.nameVersion = url.ViewUrlInfo.view_instance_common_name +" {" + url.ViewUrlInfo.view_instance_version +"}"
      }).catch(function(data) {
        Alert.error($t('views.alerts.cannotLoadViewUrl'), data.data.message);
      });
  }

  setUpEdit();


  $scope.updateUrl = function() {
      $scope.url_form.submitted = true;

      if($scope.url_form.$valid){

          var payload = {ViewUrlInfo:{
              url_name:$scope.url.url_name,
              url_suffix:$scope.url.url_suffix,
              view_instance_version:'',
              view_instance_name:'',
              view_instance_common_name:''
          }};

          View.editShortUrl(payload).then(function(urlStatus) {
              Alert.success($t('urls.urlUpdated', {
                  siteRoot: Settings.siteRoot,
                  viewName:$scope.url.view_instance_common_name ,
                  shortUrl:$scope.url.suffix,
                  urlName:$scope.url.url_name
              }));
              $scope.url_form.$setPristine();
              $location.path(targetUrl);
          }).catch(function(resp) {
              Alert.error($t('views.alerts.cannotLoadViewUrls'), resp.data.message);
          });

      }
  };


    $scope.deleteUrl = function() {

        ConfirmationModal.show(
            $t('common.delete', {
                term: $t('urls.url')
            }),
            $t('common.deleteConfirmation', {
                instanceType: $t('urls.url').toLowerCase(),
                instanceName: '"' + $scope.url.url_name + '"'
            })
        ).then(function() {
            View.deleteUrl($scope.url.url_name).then(function() {
                $location.path(targetUrl);
            });
        });



    };



}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('CreateViewInstanceCtrl',
['$scope', 'View','RemoteCluster' , 'Alert', 'Cluster', '$routeParams', '$location', 'UnsavedDialog', '$translate', '$modalInstance', 'views', 'instanceClone', '$q',
function($scope, View, RemoteCluster, Alert, Cluster, $routeParams, $location, UnsavedDialog, $translate, $modalInstance, views, instanceClone, $q) {

  var $t = $translate.instant;
  var viewToVersionMap = {};
  var instances = {};
  $scope.form = {};
  $scope.nameValidationPattern = /^\s*\w*\s*$/;
  $scope.isLoading = false;
  $scope.clusterType = 'LOCAL_AMBARI'; // LOCAL_AMBARI, REMOTE_AMBARI, NONE
  $scope.views = views;
  $scope.instanceClone = instanceClone;
  $scope.viewOptions = [];
  $scope.versionOptions = [];
  $scope.localClusters = [];
  $scope.remoteClusters = [];
  $scope.clusterOptions = [];
  $scope.fieldsWithErrors = [];
  $scope.isInstanceExists = false;
  $scope.clusterConfigurable = false;
  $scope.clusterSettingsCount = 0;
  $scope.nonClusterSettingsCount = 0;
  $scope.instanceTemplate = null;
  $scope.formData = {
    view: null,
    version: null,
    instanceName: '',
    displayName: '',
    description: '',
    clusterName: null,
    visible: true,
    settings: []
  };

  $scope.updateVersionOptions = function () {
    if (viewToVersionMap[$scope.formData.view.value]) {
      $scope.versionOptions = viewToVersionMap[$scope.formData.view.value];
      $scope.formData.version = $scope.versionOptions[0];
      $scope.updateSettingsList();
    }
  };

  $scope.updateSettingsList = function() {
    $scope.formData.settings = [];
    $scope.clusterSettingsCount = 0;
    $scope.nonClusterSettingsCount = 0;
    $scope.instanceTemplate = null;
    angular.forEach($scope.views, function(view) {
      if (view.view_name === $scope.formData.view.value) {
        angular.forEach(view.versionsList, function(version) {
          if (version.ViewVersionInfo.version === $scope.formData.version.value) {
            $scope.formData.settings = version.ViewVersionInfo.parameters.map(function(param) {
              param.value = param['defaultValue'];
              param.clusterConfig = Boolean(param.clusterConfig);
              param.displayName = param.name.replace(/\./g, '\.\u200B');
              $scope.clusterSettingsCount += param.clusterConfig;
              $scope.nonClusterSettingsCount += !param.clusterConfig;
              return param;
            });
            $scope.clusterConfigurable = version.ViewVersionInfo.cluster_configurable;
          }
        });
      }
    });
  };

  $scope.switchClusterType = function(clusterType) {
    $scope.clusterType = clusterType;
    if (clusterType === 'LOCAL_AMBARI') {
      $scope.clusterOptions = $scope.localClusters;
      resetErrors();
    } else if (clusterType === 'REMOTE_AMBARI') {
      $scope.clusterOptions = $scope.remoteClusters;
      resetErrors();
    } else {
      $scope.clusterOptions = [];
    }
    $scope.formData.clusterName = $scope.clusterOptions[0];
  };

  $scope.save = function () {
    var instanceName = $scope.form.instanceCreateForm.instanceName.$viewValue;
    $scope.form.instanceCreateForm.submitted = true;
    if ($scope.form.instanceCreateForm.$valid) {
      View.createInstance({
        instance_name: instanceName,
        label: $scope.form.instanceCreateForm.displayName.$viewValue,
        visible: $scope.form.instanceCreateForm.visible.$viewValue,
        icon_path: '',
        icon64_path: '',
        description: $scope.form.instanceCreateForm.description.$viewValue,
        view_name: $scope.form.instanceCreateForm.view.$viewValue.value,
        version: $scope.form.instanceCreateForm.version.$viewValue.value,
        properties: $scope.formData.settings,
        clusterId: $scope.formData.clusterName ? $scope.formData.clusterName.id : null,
        clusterType: $scope.clusterType
      })
        .then(function () {
          $modalInstance.dismiss('created');
          Alert.success($t('views.alerts.instanceCreated', {instanceName: instanceName}));
          $location.path('/views/' + $scope.form.instanceCreateForm.view.$viewValue.value +
            '/versions/' + $scope.form.instanceCreateForm.version.$viewValue.value +
            '/instances/' + instanceName + '/edit');
        })
        .catch(function (resp) {
          var errorMessage = resp.data.message;

          if (data.status >= 400) {
            try {
              var errorObject = JSON.parse(errorMessage);
              errorMessage = errorObject.detail;
              angular.forEach(errorObject.propertyResults, function (item, key) {
                $scope.form.instanceCreateForm[key].validationError = !item.valid;
                if (!item.valid) {
                  $scope.form.instanceCreateForm[key].validationMessage = item.detail;
                  $scope.fieldsWithErrors.push(key);
                }
              });

            } catch (e) {
              console.warn(data.message, e);
            }
          }
          Alert.error($t('views.alerts.cannotCreateInstance'), errorMessage);
        });
    }
  };

  $scope.cancel = function () {
    unsavedChangesCheck();
  };

  $scope.checkIfInstanceExist = function() {
    $scope.isInstanceExists = Boolean(instances[$scope.formData.instanceName]);
  };

  function resetErrors() {
    $scope.fieldsWithErrors.forEach(function(field) {
      $scope.form.instanceCreateForm[field].validationError = false;
      $scope.form.instanceCreateForm[field].validationMessage = '';
    });
    $scope.fieldsWithErrors = [];
  }

  function initViewAndVersionSelect () {
    $scope.viewOptions = [];
    angular.forEach($scope.views, function(view) {
      $scope.viewOptions.push({
        label: view.view_name,
        value: view.view_name
      });
      viewToVersionMap[view.view_name] = view.versionsList.map(function(version) {
        angular.forEach(version.instances, function(instance) {
          instances[instance.ViewInstanceInfo.instance_name] = true;
        });
        return {
          label: version.ViewVersionInfo.version,
          value: version.ViewVersionInfo.version
        }
      });
    });
    $scope.formData.view = $scope.viewOptions[0];
    $scope.updateVersionOptions();
  }

  function loadClusters() {
    return Cluster.getAllClusters().then(function (clusters) {
      clusters.forEach(function (cluster) {
        $scope.localClusters.push({
          label: cluster.Clusters.cluster_name,
          value: cluster.Clusters.cluster_name,
          id: cluster.Clusters.cluster_id
        });
      });
    });
  }

  function loadRemoteClusters() {
    return RemoteCluster.listAll().then(function (clusters) {
      clusters.forEach(function (cluster) {
        $scope.remoteClusters.push({
          label: cluster.ClusterInfo.name,
          value: cluster.ClusterInfo.name,
          id: cluster.ClusterInfo.cluster_id
        });
      });
    });
  }

  function loadFormData () {
    $scope.isLoading = true;
    initViewAndVersionSelect();
    $q.all(loadClusters(), loadRemoteClusters()).then(function() {
      $scope.isLoading = false;
      $scope.switchClusterType('LOCAL_AMBARI');
      copyCloneInstanceInfo();
    });
  }

  function copyCloneInstanceInfo() {
    if ($scope.instanceClone) {
      $scope.formData.view = $scope.viewOptions.filter(function(option) {
        return option.value === $scope.instanceClone.view_name;
      })[0];
      $scope.updateVersionOptions();
      $scope.formData.version = $scope.versionOptions.filter(function(option) {
        return option.value === $scope.instanceClone.version;
      })[0];
      $scope.formData.instanceName = $scope.instanceClone.instance_name + $t('common.copy');
      $scope.formData.displayName = $scope.instanceClone.label + $t('common.copy');
      $scope.formData.description = $scope.instanceClone.description;
      $scope.formData.visible = $scope.instanceClone.visible;
      $scope.switchClusterType($scope.instanceClone.cluster_type);
      $scope.updateSettingsList();
      $scope.formData.settings.forEach(function (setting) {
        if ($scope.instanceClone.properties[setting.name]) {
          setting.value = $scope.instanceClone.properties[setting.name];
        }
      });
    }
  }

  function unsavedChangesCheck() {
    if ($scope.form.instanceCreateForm.$dirty) {
      UnsavedDialog().then(function (action) {
        switch (action) {
          case 'save':
            $scope.save();
            break;
          case 'discard':
            $modalInstance.close('discard');
            break;
          case 'cancel':
            break;
        }
      });
    } else {
      $modalInstance.close('discard');
    }
  }

  loadFormData();
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('StackVersionsCreateCtrl', ['$scope', '$rootScope', 'Stack', 'Utility', '$routeParams', '$location', '$timeout' ,'Alert', '$translate', 'Cluster', 'AddRepositoryModal', 'AddVersionModal', 'ConfirmationModal',
    function($scope, $rootScope, Stack, Utility, $routeParams, $location, $timeout, Alert, $translate, Cluster, AddRepositoryModal, AddVersionModal, ConfirmationModal) {
  var $t = $translate.instant;
  $scope.constants = {
    os: $t('versions.os')
  };
  $scope.createController = true;
  $scope.osList = [];
  $scope.stackIds = [];
  $scope.allVersions = [];
  $scope.networkLost = false;
  $scope.stackRepoUpdateLinkExists = true;
  $scope.skipValidation = false;
  $scope.useRedhatSatellite = false;

  $scope.clusterName = $routeParams.clusterName;
  $scope.upgradeStack = {
    stack_name: '',
    stack_version: '',
    display_name: ''
  };

  $scope.isGPLAccepted = false;

  $scope.isGPLRepo = function (repository) {
    return  repository.Repositories.tags && repository.Repositories.tags.indexOf('GPL') >= 0;
  };

  $scope.showRepo = function (repository) {
    return $scope.isGPLAccepted || !$scope.isGPLRepo(repository);
  };

  $scope.publicOption = {
    index: 1,
    hasError: false
  };
  $scope.localOption = {
    index: 2,
    hasError: false
  };
  $scope.option1 = {
    index: 3,
    displayName: $t('versions.uploadFile'),
    file: '',
    hasError: false
  };
  $scope.option2 = {
    index: 4,
    displayName: $t('versions.enterURL'),
    url: $t('versions.defaultURL'),
    hasError: false
  };
  $scope.selectedOption = {
    index: 1
  };
  $scope.selectedLocalOption = {
    index: 3
  };

  /**
   * User can select ONLY one option to upload version definition file
   */
  $scope.toggleOptionSelect = function () {
    $scope.option1.hasError = false;
    $scope.option2.hasError = false;
  };
  $scope.isPublicRepoSelected = function () {
    if ($scope.selectedOption.index == $scope.publicOption.index) return true;
  };
  $scope.togglePublicLocalOptionSelect = function () {
    if ($scope.selectedOption.index == $scope.publicOption.index) {
      $scope.setInitialPublicRepoVersions();
    } else {
      $scope.clearRepoVersions();
    }
    $scope.validateRepoUrl();
  };
  $scope.setInitialPublicRepoVersions = function () {
    angular.forEach($scope.osList, function (os) {
      os.repositories.forEach(function(repo) {
        repo.Repositories.base_url = repo.Repositories.initial_base_url;
      });
    });
  };
  $scope.clearRepoVersions = function () {
    angular.forEach($scope.osList, function (os) {
      os.repositories.forEach(function(repo) {
        repo.Repositories.base_url = '';
      });
    });
  };
  $scope.clearOptionsError = function () {
    $scope.option1.hasError = false;
    $scope.option2.hasError = false;
  };
  $scope.readInfoButtonDisabled = function () {
    if ($scope.selectedOption.index == $scope.publicOption.index) return true;
    return $scope.option1.index == $scope.selectedLocalOption.index ? !$scope.option1.file : !$scope.option2.url;
  };
  $scope.isAddOsButtonDisabled = function () {
    var selectedCnt = 0;
    angular.forEach($scope.osList, function (os) {
      if (os.selected) {
        selectedCnt ++;
      }
    });
    return $scope.osList.length == selectedCnt || $scope.useRedhatSatellite;
  };

  $scope.allInfoCategoriesBlank = function () {
    return !$scope.upgradeStack.stack_name;
  };

  $scope.onFileSelect = function(e){
    if (e.files && e.files.length == 1) {
      var file = e.files[0];
      var reader = new FileReader();
      reader.onload = (function () {
        return function (e) {
          $scope.option1.file = e.target.result;
        };
      })(file);
      reader.readAsText(file);
    } else {
      $scope.option1.file = '';
    }
  };

  /**
   * On click handler for adding a new version
   */
  $scope.addVersion = function() {
    AddVersionModal.show($scope);
  };

  /**
   * Load selected file to current page content
   */
  $scope.readVersionInfo = function(){
    var data = {};
    var isXMLdata = false;
    if ($scope.option2.index == $scope.selectedLocalOption.index) {
      var url = $scope.option2.url;
      data = {
        "VersionDefinition": {
          "version_url": url
        }
      };
    } else if ($scope.option1.index == $scope.selectedLocalOption.index) {
      isXMLdata = true;
      // load from file browser
      data = $scope.option1.file;
    }

    return Stack.postVersionDefinitionFile(isXMLdata, data).then(function (versionInfo) {
      if (versionInfo.id && versionInfo.stackName && versionInfo.stackVersion) {
        Stack.getRepo(versionInfo.id, versionInfo.stackName, versionInfo.stackVersion)
          .then(function (response) {
            $scope.setVersionSelected(response);
        });
      }
    })
    .catch(function (data) {
      Alert.error($t('versions.alerts.readVersionInfoError'), data.message);
    });
  };

  /**
   * Load GPL License Accepted value
   */
  $scope.fetchGPLLicenseAccepted = function () {
    Stack.getGPLLicenseAccepted().then(function (data) {
      $scope.isGPLAccepted = data === 'true';
    })
  };

  /**
   * Load supported OS list
   */
  $scope.afterStackVersionRead = function () {
    Stack.getSupportedOSList($scope.upgradeStack.stack_name, $scope.upgradeStack.stack_version)
      .then(function (data) {
        var existingOSHash = {};
        angular.forEach($scope.osList, function (os) {
          if (angular.isUndefined(os.selected)) {
            os.selected = true;
          }
          existingOSHash[os.OperatingSystems.os_type] = os;

        });
        var operatingSystems = data.operating_systems;
        angular.forEach(operatingSystems, function (stackOs) {
          // if os not in the list, mark as un-selected, add this to the osList
          if (!existingOSHash[stackOs.OperatingSystems.os_type]) {
            stackOs.selected = false;
            stackOs.repositories.forEach(function(repo) {
              repo.Repositories.initial_base_url = repo.Repositories.default_base_url;
              repo.Repositories.initial_repo_id = repo.Repositories.repo_id;
            });
            $scope.osList.push(stackOs);
          }
        });
      })
      .catch(function (data) {
        Alert.error($t('versions.alerts.osListError'), data.message);
      });
  };

  /**
   * On click handler for removing OS
   */
  $scope.removeOS = function() {
    if ($scope.useRedhatSatellite) {
      return;
    }
    this.os.selected = false;
    if (this.os.repositories) {
      this.os.repositories.forEach(function(repo) {
        repo.hasError = false;
      });
    }
  };
  /**
   * On click handler for adding new OS
   */
  $scope.addOS = function($event) {
    var dropdownEl = $event.target.parentElement.parentElement;
    // close the dopdown when an OS is added.
    $timeout(function () {
      dropdownEl.click();
    });

    this.os.selected = true;
    if (this.os.repositories) {
      this.os.repositories.forEach(function(repo) {
        repo.hasError = false;
      });
    }
  };

  /**
   * On click handler for adding a new repository
   */
  $scope.addRepository = function() {
    AddRepositoryModal.show($scope.osList, $scope.upgradeStack.stack_name, $scope.upgradeStack.stack_version, $scope.id);
  };

  $scope.validBaseUrlsExist = function () {
    var validBaseUrlsExist = true;
    if ($scope.osList) {
      $scope.osList.forEach(function(os) {
        if (os.repositories && os.selected) {
          os.repositories.forEach(function(repo) {
            if (repo.invalidBaseUrl && $scope.showRepo(repo)) {
              validBaseUrlsExist = false;
            }
          })
        }
      });
    }
    return validBaseUrlsExist;
  };


  $scope.isSaveButtonDisabled = function() {
    var enabled = false;
    $scope.osList.forEach(function(os) {
      if (os.selected) {
        enabled = true
      }
    });
    return !($scope.useRedhatSatellite || (enabled && $scope.validBaseUrlsExist()));
  };

  $scope.defaulfOSRepos = {};

  $scope.save = function () {
    $scope.editVersionDisabled = true;
    delete $scope.updateObj.href;
    $scope.updateObj.operating_systems = [];
    angular.forEach($scope.osList, function (os) {
      os.OperatingSystems.ambari_managed_repositories = !$scope.useRedhatSatellite;
      if (os.selected) {
        $scope.updateObj.operating_systems.push(os);
      }
    });

    var skip = $scope.skipValidation || $scope.useRedhatSatellite;
    // Filter out repositories that are not shown in the UI
    var osList = Object.assign([], $scope.osList).map(function(os) {
      return Object.assign({}, os, {repositories: os.repositories.filter(function(repo) { return $scope.showRepo(repo); })});
    });
    return Stack.validateBaseUrls(skip, osList, $scope.upgradeStack).then(function (invalidUrls) {
      if (invalidUrls.length === 0) {
        if ($scope.isPublicVersion) {
          var data = {
            "VersionDefinition": {
              "available": $scope.id
            }
          };
          var isXMLdata = false;
        } else {
          var data = $scope.data;
          var isXMLdata = $scope.isXMLdata;
        }

        if (!isXMLdata) {
          data.VersionDefinition.display_name = $scope.activeStackVersion.displayName;
        }

        var repoUpdate = {
          operating_systems: $scope.updateObj.operating_systems
        };
        Stack.postVersionDefinitionFile(isXMLdata, data, false).then(function (response) {
          var versionInfo = response.resources[0].VersionDefinition;
          if (versionInfo.id && versionInfo.stack_name && versionInfo.stack_version) {
            Stack.updateRepo(versionInfo.stack_name, versionInfo.stack_version, versionInfo.id, repoUpdate).then(function () {
              Alert.success($t('versions.alerts.versionCreated', {
                stackName: $scope.upgradeStack.stack_name,
                versionName: $scope.actualVersion
              }));
              $location.path('/stackVersions');
            }).catch(function (data) {
              Stack.deleteRepo(versionInfo.stack_name, versionInfo.stack_version, versionInfo.id);
              ConfirmationModal.show(
                $t('versions.register.error.header'),
                $t('versions.register.error.body'),
                null,
                null,
                {hideCancelButton: true}
              )
            });
          }
        })
        .catch(function (resp) {
          Alert.error($t('versions.alerts.readVersionInfoError'), data.message);
        });
      } else {
        Stack.highlightInvalidUrls(invalidUrls);
      }
    });
  };

  $scope.updateRepoVersions = function () {
    var skip = $scope.skipValidation || $scope.useRedhatSatellite;
    // Filter out repositories that are not shown in the UI
    var osList = Object.assign([], $scope.osList).map(function(os) {
      return Object.assign({}, os, {repositories: os.repositories.filter(function(repo) { return $scope.showRepo(repo); })});
    });
    return Stack.validateBaseUrls(skip, osList, $scope.upgradeStack).then(function (invalidUrls) {
      if (invalidUrls.length === 0) {
        Stack.updateRepo($scope.upgradeStack.stack_name, $scope.upgradeStack.stack_version, $scope.id, $scope.updateObj).then(function () {
          Alert.success($t('versions.alerts.versionEdited', {
            stackName: $scope.upgradeStack.stack_name,
            versionName: $scope.actualVersion,
            displayName: $scope.repoVersionFullName
          }));
          $location.path('/stackVersions');
        }).catch(function (data) {
          Alert.error($t('versions.alerts.versionUpdateError'), data.message);
        });
      } else {
        Stack.highlightInvalidUrls(invalidUrls);
      }
    });
  };

  $scope.cancel = function () {
    $scope.editVersionDisabled = true;
    $location.path('/stackVersions');
  };

  $scope.clearErrors = function() {
    if ($scope.osList) {
      $scope.osList.forEach(function(os) {
        if (os.repositories) {
          os.repositories.forEach(function(repo) {
            repo.hasError = false;
          })
        }
      });
    }
  };

  $scope.useRedHatCheckbox = function() {
    if ($scope.useRedhatSatellite) {
      ConfirmationModal.show(
        $t('versions.useRedhatSatellite.title'),
        {
          "url": 'views/modals/BodyForUseRedhatSatellite.html'
        }
      ).catch(function () {
        $scope.useRedhatSatellite = !$scope.useRedhatSatellite;
      });
    } else {
      if ($scope.osList) {
        $scope.osList.forEach(function(os) {
          if (os.repositories) {
            os.repositories.forEach(function(repo) {
              repo.isEditing = false;
            })
          }
        });
      }
    }
  };

  $scope.showPublicRepoDisabledDialog = function() {
    ConfirmationModal.show(
      $t('versions.networkIssues.publicDisabledHeader'),
      {
        "url": 'views/modals/publicRepoDisabled.html'
      },
      $t('common.controls.ok'),
      $t('common.controls.cancel'),
      {hideCancelButton: true}
    )
  };

  $scope.onRepoUrlChange = function (repository) {
    $scope.clearError(repository);
    $scope.setInvalidUrlError(repository);
    $scope.setUsernameAndPasswordsIfNeeded(repository);
  };

  $scope.setUsernameAndPasswordsIfNeeded = function(repo) {
    if ($rootScope.supports.disableCredentialsAutocompleteForRepoUrls) {
      return;
    }
    try {
      var urlObject = new URL(repo.Repositories.base_url);
      var username = urlObject.username;
      var password = urlObject.password;
    } catch (e) {
      return;
    }
    $scope.osList.forEach(function(os) {
      if (os.repositories) {
        os.repositories.forEach(function (repo) {
          var currentUrl = repo.Repositories.base_url;
          try {
            var currentUrlObject = new URL(currentUrl);
          } catch (e) {
            return;
          }
          currentUrlObject.username = username;
          currentUrlObject.password = password;
          repo.Repositories.base_url = currentUrlObject.toString();
        });
      }
    });
  };

  $scope.undoChange = function(repo) {
    if ($scope.selectedOption.index == 1) {
      repo.Repositories.base_url = repo.Repositories.initial_base_url;
    } else {
      repo.Repositories.base_url = '';
    }
  };

  $scope.clearError = function(repository) {
    repository.hasError = false;
  };

  $scope.setInvalidUrlError = function (repository) {
    repository.invalidBaseUrl =  !$scope.isValidRepoBaseUrl(repository.Repositories.base_url);
  };
  /**
   * Validate base URL
   * @param {string} value
   * @returns {boolean}
   */
  $scope.isValidRepoBaseUrl = function (value) {
    var remotePattern = /^(?:(?:https?|ftp):\/{2})(?:\S+(?::\S*)?@)?(?:(?:(?:[\w\-.]))*)(?::[0-9]+)?(?:\/\S*)?$/,
      localPattern = /^file:\/{2,3}([a-zA-Z][:|]\/){0,1}[\w~!*'();@&=\/\\\-+$,?%#.\[\]]+$/;
    return remotePattern.test(value) || localPattern.test(value);
  };

  $scope.hasValidationErrors = function() {
    var hasErrors = false;
    if ($scope.osList) {
      $scope.osList.forEach(function(os) {
        if (os.repositories) {
          os.repositories.forEach(function(repo) {
            if (repo.hasError) {
              hasErrors = true;
            }
          })
        }
      });
    }
    return hasErrors;
  };


  $scope.setVersionSelected = function (version) {
    var response = version;
    var stackVersion = response.updateObj.RepositoryVersions || response.updateObj.VersionDefinition;
    $scope.id = response.id;
    $scope.isPatch = stackVersion.type === 'PATCH';
    $scope.isMaint = stackVersion.type === 'MAINT';
    $scope.stackNameVersion = response.stackNameVersion || $t('common.NA');
    $scope.displayName = response.displayName || $t('common.NA');
    $scope.actualVersion = response.repositoryVersion || response.actualVersion || $t('common.NA');
    $scope.isPublicVersion = response.showAvailable == true;
    $scope.updateObj = response.updateObj;
    $scope.upgradeStack = {
      stack_name: response.stackName,
      stack_version: response.stackVersion,
      display_name: response.displayName || $t('common.NA')
    };
    $scope.activeStackVersion.services = Stack.filterAvailableServices(response);
    $scope.repoVersionFullName = response.repoVersionFullName;
    $scope.osList = response.osList;

    // load supported os type base on stack version
    $scope.afterStackVersionRead();

    // Load GPL license accepted value
    $scope.fetchGPLLicenseAccepted();
  };

  $scope.selectRepoInList = function() {
    $scope.selectedPublicRepoVersion = this.version;
    $scope.setVersionSelected(this.version);
  };

  $scope.onStackIdChange = function () {
    $scope.setStackIdActive(this.stack);
    $scope.setVisibleStackVersions($scope.allVersions);
    $scope.setVersionSelected($scope.activeStackVersion);
  };

  $scope.setStackIdActive =  function (stack) {
    angular.forEach($scope.stackIds, function(_stack){
      _stack.isSelected = false;
    });
    stack.isSelected = true;
  };

  $scope.setStackIds = function(stacks) {
    var stackIds = [];
    // sort stacks as per per {stack_name}-{stack_version}
    stacks.sort(function(a,b){
      if (a.stackName === b.stackName) {
        var aStackVersion = parseFloat(a.stackVersion);
        var bStackVersion = parseFloat(b.stackVersion);
        if (aStackVersion === bStackVersion) {
          // sort numerically as per per {repository_version}
          return Utility.compareVersions(a.repositoryVersion, b.repositoryVersion);
        } else {
          //sort numerically as per per {stack_version}
          return aStackVersion > bStackVersion;
        }
      } else {
        //sort lexicographically as per per {stack_name}
        return  (a.stackName > b.stackName);
      }
    }).reverse();
    angular.forEach(stacks, function (stack) {
      stackIds.push(stack.stackNameVersion);
    });
    $scope.stackIds = stackIds.filter(function(item, index, self){
      return self.indexOf(item) === index;
    }).map(function(item){
      return {
        stackNameVersion: item,
        isSelected: false
      };
    });
    $scope.stackIds[0].isSelected = true;
  };

  $scope.setActiveVersion = function () {
    $scope.activeStackVersion = this.version;
    $scope.setVersionSelected($scope.activeStackVersion);
  };

  $scope.setVisibleStackVersions = function (versions) {
    var activeStackId = $scope.stackIds.find(function(item){
      return item.isSelected === true;
    });
    angular.forEach(versions, function (item, index) {
      item.visible = (item.stackNameVersion === activeStackId.stackNameVersion);
    });
    $scope.activeStackVersion = versions.filter(function(item){
      return item.visible;
    })[0];
  };

  /**
   * Return true if at least one stacks have the repo URL link in the repoinfo.xml
   * @return boolean
   * */
  $scope.setStackRepoUpdateLinkExists = function (versions) {
    var stackRepoUpdateLinkExists = versions.find(function(_version){
      return _version.stackRepoUpdateLinkExists;
    });

    //Found at least one version with the stack repo update link
    if (stackRepoUpdateLinkExists){
      $scope.stackRepoUpdateLinkExists = true;
    } else {
      $scope.stackRepoUpdateLinkExists = false;
    }
  };

  $scope.setNetworkIssues = function (versions) {
   $scope.networkLost = !versions.find(function(_version){
     return !_version.stackDefault;
   });
    if ($scope.networkLost) {
      $scope.selectedOption.index = 2;
      $scope.clearRepoVersions();
    }
  };

  $scope.validateRepoUrl = function () {
    angular.forEach($scope.osList,function(os){
      if (os.repositories) {
        os.repositories.forEach(function(repo) {
          $scope.onRepoUrlChange(repo);
        });
      }
    });
  };

  $scope.updateCurrentVersionInput = function () {
    $scope.activeStackVersion.displayName = $scope.activeStackVersion.stackNameVersion + "." + angular.element('[name="version"]')[0].value;
  };

  $scope.fetchPublicVersions = function () {
    return Stack.allPublicStackVersions().then(function (versions) {
      if (versions && versions.length) {
        $scope.setStackIds(versions);
        $scope.setVisibleStackVersions(versions);
        $scope.allVersions = versions;
        $scope.selectedPublicRepoVersion = $scope.activeStackVersion;
        $scope.setVersionSelected($scope.activeStackVersion);
        $scope.setNetworkIssues(versions);
        $scope.setStackRepoUpdateLinkExists(versions);
        $scope.validateRepoUrl();
        $scope.availableStackRepoList = versions.length == 1 ? [] : versions;
      }
    });
  };

  $scope.fetchPublicVersions();
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
  .controller('StackVersionsListCtrl',
  ['$scope', 'Cluster', 'Stack', '$routeParams', '$translate', 'Settings', 'Pagination', '$q', 'Filters',
  function ($scope, Cluster, Stack, $routeParams, $translate, Settings, Pagination, $q, Filters) {
    var $t = $translate.instant;
    $scope.getConstant = function (key) {
      return $t(key).toLowerCase();
    };
    $scope.minInstanceForPagination = Settings.minRowsToShowPagination;
    $scope.isLoading = false;
    $scope.clusterName = $routeParams.clusterName;
    $scope.tableInfo = {
      total: 0,
      showed: 0,
      filtered: 0
    };
    $scope.repos = [];
    $scope.dropDownClusters = [];
    $scope.selectedCluster = $scope.dropDownClusters[0];
    $scope.filters = [
      {
        key: 'stack',
        label: $t('common.stack'),
        customValueConverter: function(item) {
          return item.stack_name + '-' + item.stack_version;
        },
        options: []
      },
      {
        key: 'display_name',
        label: $t('common.name'),
        options: []
      },
      {
        key: 'type',
        label: $t('common.type'),
        options: []
      },
      {
        key: 'repository_version',
        label: $t('common.version'),
        options: []
      },
      {
        key: 'cluster',
        label: $t('common.cluster'),
        options: []
      }
    ];
    $scope.pagination = Pagination.create();

    $scope.resetPagination = function() {
      $scope.pagination.resetPagination($scope.repos, $scope.tableInfo);
    };

    $scope.pageChanged = function() {
      $scope.pagination.pageChanged($scope.repos, $scope.tableInfo);
    };

    $scope.filterRepos = function (appliedFilters) {
      $scope.tableInfo.filtered = Filters.filterItems(appliedFilters, $scope.repos, $scope.filters);
      $scope.pagination.resetPagination($scope.repos, $scope.tableInfo);
    };

    $scope.toggleSearchBox = function() {
      $('.search-box-button .popup-arrow-up, .search-box-row').toggleClass('hide');
    };

    $scope.goToCluster = function() {
      window.location.replace(Settings.siteRoot + '#/main/admin/stack/versions');
    };

    $scope.fetchRepoClusterStatus = function (allRepos) {
      var calls = [];
      if (allRepos && allRepos.length) {
        // only support one cluster at the moment
        var clusterName = $scope.cluster && $scope.cluster.Clusters.cluster_name;
        if (clusterName) {
          $scope.repos = allRepos;
          $scope.tableInfo.total = allRepos.length;
          angular.forEach($scope.repos, function (repo) {
            calls.push(Cluster.getRepoVersionStatus(clusterName, repo.id).then(function (response) {
              repo.cluster = (response.status === 'CURRENT' || response.status === 'INSTALLED') ? clusterName : '';
              if (repo.cluster) {
                repo.status = response.status;
                repo.totalHosts = response.totalHosts;
                repo.currentHosts = response.currentHosts;
                repo.installedHosts = response.installedHosts;
                repo.stackVersionId = response.stackVersionId;
              }
            }));
          });
        }
      } else {
        $scope.repos = [];
        $scope.tableInfo.total = 0;
        $scope.pagination.totalRepos = 0;
        $scope.tableInfo.showed = 0;
      }
      $scope.tableInfo.total = $scope.repos.length;
      return $q.all(calls);
    };

    $scope.fetchRepos = function () {
      return Stack.allRepos().then(function (repos) {
        $scope.isLoading = false;
        return repos.items;
      });
    };

    $scope.fetchClusters = function () {
      return Cluster.getAllClusters().then(function (clusters) {
        if (clusters && clusters.length > 0) {
          $scope.dropDownClusters = clusters;
        }
      });
    };

    $scope.loadAllData = function () {
      $scope.isLoading = true;
      $scope.fetchRepos()
        .then(function (repos) {
          $scope.fetchClusters();
          $scope.fetchRepoClusterStatus(repos).then(function() {
            Filters.initFilterOptions($scope.filters, $scope.repos);
          });
          $scope.filterRepos();
        });
    };

    $scope.loadAllData();

    $scope.toggleVisibility = function (repo) {
      repo.isProccessing = true;
      var payload = {
        RepositoryVersions: {
          hidden: repo.hidden
        }
      };
      Stack.updateRepo(repo.stack_name, repo.stack_version, repo.id, payload).then(null, function () {
        repo.hidden = !repo.hidden;
      }).finally(function () {
        delete repo.isProccessing;
      });
    };

    $scope.isHideCheckBoxEnabled = function ( repo ) {
      return !repo.isProccessing && ( (!repo.cluster && repo.status !== 'OUT_OF_SYNC') || repo.isPatch && ( repo.status === 'INSTALLED' || repo.status === 'INSTALL_FAILED' ) || repo.hidden);
    }
  }]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('StackVersionsEditCtrl', ['$scope', '$rootScope', '$location', 'Cluster', 'Stack', '$routeParams', 'ConfirmationModal', 'Alert', '$translate', 'AddRepositoryModal', function($scope, $rootScope, $location, Cluster, Stack, $routeParams, ConfirmationModal, Alert, $translate, AddRepositoryModal) {
  var $t = $translate.instant;
  $scope.constants = {
    os: $t('versions.os')
  };
  $scope.editController = true;
  $scope.osList = []; // view modal for display repo urls of various OSes
  $scope.skipValidation = false;
  $scope.useRedhatSatellite = false;
  $scope.upgradeStack = {
    stack_name: '',
    stack_version: '',
    display_name: ''
  };
  $scope.defaulfOSRepos = {}; // a copy of initial loaded repo info for "changed" check later
  $scope.isGPLAccepted = false;

  $scope.isGPLRepo = function (repository) {
    return repository.Repositories.tags.indexOf('GPL') >= 0;
  };

  $scope.showRepo = function (repository) {
    return $scope.isGPLAccepted || !$scope.isGPLRepo(repository);
  };

  $scope.loadStackVersionInfo = function () {
    return Stack.getRepo($routeParams.versionId, $routeParams.stackName).then(function (response) {
      var stackVersion = response.updateObj.RepositoryVersions || response.updateObj.VersionDefinition;
      $scope.activeStackVersion = response;
      $scope.id = response.id;
      $scope.isPatch = stackVersion.type === 'PATCH';
      $scope.isMaint = stackVersion.type === 'MAINT';
      $scope.stackNameVersion = response.stackNameVersion || $t('common.NA');
      $scope.displayName = response.displayName || $t('common.NA');
      $scope.version = response.version || $t('common.NA');
      $scope.actualVersion = response.actualVersion || $t('common.NA');
      $scope.useRedhatSatellite = !response.ambari_managed_repositories;
      $scope.updateObj = response.updateObj;
      $scope.upgradeStack = {
        stack_name: response.stackName,
        stack_version: response.stackVersion,
        display_name: response.displayName
      };
      $scope.activeStackVersion.services = Stack.filterAvailableServices(response);
      response.updateObj.operating_systems.forEach(function(os) {
        $scope.defaulfOSRepos[os.OperatingSystems.os_type] = {};
        os.repositories.forEach(function(repo) {
          $scope.defaulfOSRepos[os.OperatingSystems.os_type][repo.Repositories.repo_id] = repo.Repositories.base_url;
          repo.Repositories.initial_repo_id = repo.Repositories.repo_id;
        });
      });
      $scope.repoVersionFullName = response.repoVersionFullName;
      angular.forEach(response.osList, function (os) {
        os.selected = true;
      });
      $scope.osList = response.osList;
      // load supported os type base on stack version
      $scope.afterStackVersionRead();

      // Load GPL license accepted value
      $scope.fetchGPLLicenseAccepted();

      // if user reach here from UI click, repo status should be cached
      // otherwise re-fetch repo status from cluster end point.
      $scope.repoStatus = Cluster.repoStatusCache[$scope.id];
      if (!$scope.repoStatus) {
        $scope.fetchClusters()
        .then(function () {
          return $scope.fetchRepoClusterStatus();
        })
        .then(function () {
          $scope.deleteEnabled = $scope.isDeletable();
        });
      } else {
        $scope.deleteEnabled = $scope.isDeletable();
      }
    });
  };

  /**
   * Load GPL License Accepted value
   */
  $scope.fetchGPLLicenseAccepted = function () {
    Stack.getGPLLicenseAccepted().then(function (data) {
      $scope.isGPLAccepted = data === 'true';
    })
  };

  /**
   * Load supported OS list
   */
  $scope.afterStackVersionRead = function () {
    Stack.getSupportedOSList($scope.upgradeStack.stack_name, $scope.upgradeStack.stack_version)
      .then(function (data) {
        var operatingSystems = data.operating_systems;
        operatingSystems.map(function (os) {
          var existingOSHash = {};
          angular.forEach($scope.osList, function (os) {
            os.repositories.forEach(function(repo) {
              repo.Repositories.initial_base_url = repo.Repositories.base_url;
            });
            existingOSHash[os.OperatingSystems.os_type] = os;
          });
          // if os not in the list, mark as un-selected, add this to the osList
          if (!existingOSHash[os.OperatingSystems.os_type]) {
            os.selected = false;
            os.repositories.forEach(function(repo) {
              repo.Repositories.base_url = '';
            });
            $scope.osList.push(os);
          }
        });
      })
      .catch(function (data) {
        Alert.error($t('versions.alerts.osListError'), data.message);
      });
  };

  $scope.isDeletable = function() {
    return !($scope.repoStatus === 'CURRENT' || $scope.repoStatus === 'INSTALLED');
  };

  $scope.disableUnusedOS = function() {
    Cluster.getClusterOS().then(function(usedOS){
      angular.forEach($scope.osList, function (os) {
        if (os.OperatingSystems.os_type !== usedOS) {
          os.disabled = true;
        }
      });
    });
  };

  $scope.save = function () {
    $scope.editVersionDisabled = true;
    delete $scope.updateObj.href;
    $scope.updateObj.operating_systems = [];
    // check if there is any change in repo list
    var changed = false;
    angular.forEach($scope.osList, function (os) {
      var savedUrls = $scope.defaulfOSRepos[os.OperatingSystems.os_type];
      if (os.selected) { // currently shown?
        if (savedUrls) { // initially loaded?
          angular.forEach(os.repositories, function (repo) {
            if (repo.Repositories.base_url != savedUrls[repo.Repositories.repo_id]) {
              changed = true; // modified
            }
          });
        } else {
          changed = true; // added
        }
        os.OperatingSystems.ambari_managed_repositories = !$scope.useRedhatSatellite;
        $scope.updateObj.operating_systems.push(os);
      } else {
        if (savedUrls) {
          changed = true; // removed
        }
      }
    });
    // show confirmation when making changes to current/installed repo
    if (changed && !$scope.deleteEnabled) {
      ConfirmationModal.show(
          $t('versions.changeBaseURLConfirmation.title'),
          $t('versions.changeBaseURLConfirmation.message'),
          $t('common.controls.confirmChange')
      ).then(function() {
        $scope.updateRepoVersions();
      });
    } else {
      $scope.updateRepoVersions();
    }
  };

  $scope.updateRepoVersions = function () {
    var skip = $scope.skipValidation || $scope.useRedhatSatellite;
    // Filter out repositories that are not shown in the UI
    var osList = Object.assign([], $scope.osList).map(function(os) {
      return Object.assign({}, os, {repositories: os.repositories.filter(function(repo) { return $scope.showRepo(repo); })});
    });
    return Stack.validateBaseUrls(skip, osList, $scope.upgradeStack).then(function (invalidUrls) {
      if (invalidUrls.length === 0) {
        Stack.updateRepo($scope.upgradeStack.stack_name, $scope.upgradeStack.stack_version, $scope.id, $scope.updateObj).then(function () {
          Alert.success($t('versions.alerts.versionEdited', {
            stackName: $scope.upgradeStack.stack_name,
            versionName: $scope.actualVersion,
            displayName: $scope.repoVersionFullName
          }));
          $location.path('/stackVersions');
        }).catch(function (data) {
          Alert.error($t('versions.alerts.versionUpdateError'), data.message);
        });
      } else {
        Stack.highlightInvalidUrls(invalidUrls);
      }
    });
  };

  $scope.fetchRepoClusterStatus = function () {
    var clusterName = ($scope.clusters && $scope.clusters.length > 0)
      ? $scope.clusters[0].Clusters.cluster_name : null; // only support one cluster at the moment
    if (!clusterName) {
      return null;
    }
    return Cluster.getRepoVersionStatus(clusterName, $scope.id).then(function (response) {
      $scope.repoStatus = response.status;
    });
  };

  $scope.fetchClusters = function () {
    return Cluster.getAllClusters().then(function (clusters) {
      $scope.clusters = clusters;
    });
  };

  $scope.delete = function () {
    ConfirmationModal.show(
      $t('versions.deregister'),
      {
        "url": 'views/modals/BodyForDeregisterVersion.html',
        "scope": {"displayName": $scope.repoVersionFullName }
      }
    ).then(function() {
        Stack.deleteRepo($scope.upgradeStack.stack_name, $scope.upgradeStack.stack_version, $scope.id).then( function () {
          $location.path('/stackVersions');
        }).catch(function (resp) {
            Alert.error($t('versions.alerts.versionDeleteError'), resp.data.message);
          });
      });
  };

  /**
   * On click handler for removing OS
   */
  $scope.removeOS = function() {
    if ($scope.useRedhatSatellite) {
      return;
    }
    this.os.selected = false;
    if (this.os.repositories) {
      this.os.repositories.forEach(function(repo) {
        repo.hasError = false;
      });
    }
  };
  /**
   * On click handler for adding new OS
   */
  $scope.addOS = function() {
    this.os.selected = true;
    if (this.os.repositories) {
      this.os.repositories.forEach(function(repo) {
        repo.hasError = false;
      });
    }
  };

  $scope.isAddOsButtonDisabled = function () {
    var selectedCnt = 0;
    angular.forEach($scope.osList, function (os) {
      if (os.selected) {
        selectedCnt ++;
      }
    });
    return $scope.osList.length == selectedCnt || $scope.useRedhatSatellite;
  };

  $scope.hasNotDeletedRepo = function () {
    //check if any repository has been selected for deleting
    //if yes, drop down should be displayed
    var repoNotDeleted = true;
    for(var i=0;i<$scope.osList.length;i++) {
      if (!$scope.osList[i].selected) {
        repoNotDeleted=false;
        break; 
      }
    }
    return repoNotDeleted;
  };

  /**
   * On click handler for adding a new repository
   */
  $scope.addRepository = function() {
    AddRepositoryModal.show($scope.osList, $scope.upgradeStack.stack_name, $scope.upgradeStack.stack_version, $scope.id);
  };

  $scope.isSaveButtonDisabled = function() {
    var enabled = false;
    $scope.osList.forEach(function(os) {
      if (os.selected) {
        enabled = true
      }
    });
    return !enabled;
  };

  $scope.cancel = function () {
    $scope.editVersionDisabled = true;
    $location.path('/stackVersions');
  };

  $scope.undoChange = function(repo) {
    repo.Repositories.base_url = repo.Repositories.initial_base_url;
  };

  $scope.onRepoUrlChange = function(repo) {
    if ($rootScope.supports.disableCredentialsAutocompleteForRepoUrls) {
      return;
    }
    try {
      var urlObject = new URL(repo.Repositories.base_url);
      var username = urlObject.username;
      var password = urlObject.password;
    } catch (e) {
      return;
    }
    $scope.osList.forEach(function(os) {
      if (os.repositories) {
        os.repositories.forEach(function (repo) {
          var currentUrl = repo.Repositories.base_url;
          try {
            var currentUrlObject = new URL(currentUrl);
          } catch (e) {
            return;
          }
          currentUrlObject.username = username;
          currentUrlObject.password = password;
          repo.Repositories.base_url = currentUrlObject.toString();
        });
      }
    });
  };

  $scope.clearErrors = function() {
    if ($scope.osList) {
      $scope.osList.forEach(function(os) {
        if (os.repositories) {
          os.repositories.forEach(function(repo) {
            repo.hasError = false;
          })
        }
      });
    }
  };

  $scope.useRedHatCheckbox = function() {
    if ($scope.useRedhatSatellite) {
      ConfirmationModal.show(
        $t('versions.useRedhatSatellite.title'),
        {
          "url": 'views/modals/BodyForUseRedhatSatellite.html'
        }
      ).catch(function () {
        $scope.useRedhatSatellite = !$scope.useRedhatSatellite;
      });
    } else {
      if ($scope.osList) {
        $scope.osList.forEach(function(os) {
          if (os.repositories) {
            os.repositories.forEach(function(repo) {
              repo.isEditing = false;
            })
          }
        });
      }
    }
  };

  $scope.clearError = function () {
    this.repository.hasError = false;
  };

  $scope.hasValidationErrors = function () {
    var hasErrors = false;
    if ($scope.osList) {
      $scope.osList.forEach(function (os) {
        if (os.repositories) {
          os.repositories.forEach(function (repo) {
            if (repo.hasError) {
              hasErrors = true;
            }
          })
        }
      });
    }
    return hasErrors;
  };

  $scope.loadStackVersionInfo();
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('RemoteClustersCreateCtrl', ['$scope', '$routeParams', '$location', 'Alert', '$translate', 'Cluster', 'AddRepositoryModal' , 'Settings', 'RemoteCluster', function($scope, $routeParams, $location, Alert, $translate, Cluster, AddRepositoryModal, Settings, RemoteCluster) {
  var $t = $translate.instant;

  $scope.cluster = {};

  $scope.nameValidationPattern = /^\s*\w*\s*$/;
  $scope.urlValidationPattern = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i;

  $scope.registerRemoteCluster = function () {
    $scope.form.submitted = true;
    if ($scope.form.$valid){
     var payload = {
        "ClusterInfo" :{
          "name" : $scope.cluster.cluster_name,
          "url" : $scope.cluster.cluster_url,
          "username" : $scope.cluster.cluster_user,
          "password" : $scope.cluster.cluster_password
        }
      };

      var config = {
        headers : {
          'X-Requested-By': 'Ambari;'
        }
      }

      RemoteCluster.register(payload, config).then(function(data) {
          Alert.success($t('common.alerts.remoteClusterRegistered', {clusterName: payload.ClusterInfo.name}));
          $scope.form.$setPristine();
          $location.path('/remoteClusters/'+ $scope.cluster.cluster_name +'/edit')
        })
        .catch(function(resp) {
          console.log(data);
          Alert.error(resp.data.message);
       });

    }
  };

  $scope.cancel = function () {
    $scope.editVersionDisabled = true;
    $location.path('/remoteClusters');
  };


}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('RemoteClustersListCtrl',
['$scope', '$routeParams', '$translate', 'RemoteCluster', 'Settings', 'Pagination', 'Filters',
function ($scope, $routeParams, $translate, RemoteCluster, Settings, Pagination, Filters) {
  var $t = $translate.instant;

  $scope.minInstanceForPagination = Settings.minRowsToShowPagination;
  $scope.clusterName = $routeParams.clusterName;
  $scope.isLoading = false;
  $scope.constants = {
    groups: $t('common.clusters').toLowerCase()
  };
  $scope.tableInfo = {
    filtered: 0,
    total: 0,
    showed: 0
  };
  $scope.pagination = Pagination.create();
  $scope.filters = [
    {
      key: 'clusterName',
      label: $t('views.clusterName'),
      options: []
    },
    {
      key: 'service',
      label: $t('common.services'),
      customValueConverter: function (item) {
        return item.ClusterInfo.services;
      },
      isMultiple: true,
      options: []
    }
  ];

  $scope.toggleSearchBox = function () {
    $('.search-box-button .popup-arrow-up, .search-box-row').toggleClass('hide');
  };

  $scope.filterClusters = function (appliedFilters) {
    $scope.tableInfo.filtered = Filters.filterItems(appliedFilters, $scope.remoteClusters, $scope.filters);
    $scope.pagination.resetPagination($scope.remoteClusters, $scope.tableInfo);
  };

  $scope.pageChanged = function () {
    $scope.pagination.pageChanged($scope.remoteClusters, $scope.tableInfo);
  };

  $scope.resetPagination = function () {
    $scope.pagination.resetPagination($scope.remoteClusters, $scope.tableInfo);
  };

  function loadRemoteClusters() {
    $scope.isLoading = true;
    RemoteCluster.all().then(function (remoteclusters) {
      $scope.isLoading = false;
      $scope.remoteClusters = remoteclusters.items.map(function (item) {
        item.clusterName = item.ClusterInfo.name;
        return item;
      });
      $scope.tableInfo.total = $scope.remoteClusters.length;
      $scope.filterClusters();
      Filters.initFilterOptions($scope.filters, $scope.remoteClusters);
    }).catch(function (data) {
      console.error($t('remoteClusters.alerts.fetchError'), data);
    });
  }

  loadRemoteClusters();

}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('RemoteClustersEditCtrl', ['$scope', '$modal', '$routeParams', '$location', 'Alert', '$translate', 'Cluster', 'Settings','RemoteCluster', 'DeregisterClusterModal', function($scope, $modal, $routeParams, $location, Alert, $translate, Cluster, Settings, RemoteCluster, DeregisterClusterModal) {
  var $t = $translate.instant;

  $scope.cluster = {};
  $scope.instancesAffected = [];

  $scope.nameValidationPattern = /^\s*\w*\s*$/;
  $scope.urlValidationPattern = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i;

  $scope.openChangePwdDialog = function() {
    var modalInstance = $modal.open({
      templateUrl: 'views/remoteClusters/modals/changePassword.html',
      resolve: {
        clusterId: function() {
          return $scope.cluster.cluster_id;
        },
        clusterName: function() {
          return $scope.cluster.cluster_name;
        },
        clusterUrl: function() {
          return $scope.cluster.cluster_url;
        },
        clusterUser: function() {
          return $scope.cluster.cluster_user;
        }
      },
      controller: ['$scope', 'clusterId' ,'clusterName', 'clusterUrl', 'clusterUser', 'Settings','Alert',  function($scope, clusterId, clusterName, clusterUrl , clusterUser , Settings, Alert) {
        $scope.passwordData = {
          password: '',
          currentUserName: clusterUser || ''
        };

        $scope.form = {};

        $scope.clusterId = clusterId;
        $scope.currentUser = clusterUser;
        $scope.clusterName = clusterName;
        $scope.clusterUrl = clusterUrl;

        $scope.ok = function() {
          $scope.form.passwordChangeForm.submitted = true;


          if ($scope.form.passwordChangeForm.$valid){

            var payload = {
              "ClusterInfo" :{
                "cluster_id" : $scope.clusterId,
                "name" : $scope.clusterName,
                "url" : $scope.clusterUrl,
                "username" : $scope.passwordData.currentUserName,
                "password" : $scope.passwordData.password
              }
            };

            var config = {
              headers : {
                'X-Requested-By': 'Ambari;'
              }
            }

            RemoteCluster.edit(payload, config).then(function() {
                Alert.success($t('views.alerts.credentialsUpdated'));
                $scope.form.passwordChangeForm = {};
              })
              .catch(function(resp) {
                console.log(resp);
                Alert.error(resp.data.message);
              });

            modalInstance.dismiss('cancel');
          }

        };
        $scope.cancel = function() {
          modalInstance.dismiss('cancel');
        };
      }]
    });
  };

  $scope.deleteCluster = function() {

    $scope.instancesAffected = [];
    RemoteCluster.affectedViews($scope.cluster.cluster_name).then(function(response) {

        response.items.forEach(function(item){
          item.versions.forEach(function(version){
            version.instances.forEach(function(instance){
              $scope.instancesAffected.push(instance.ViewInstanceInfo.instance_name);
            })
          })
        })

        DeregisterClusterModal.show(
          $t('common.deregisterCluster',{term: $t('common.cluster')}),
          $t('common.remoteClusterDelConfirmation', {instanceType: $t('common.cluster').toLowerCase(), instanceName: '"' + $scope.cluster.cluster_name + '"'}),
          $scope.instancesAffected

        ).then(function() {
          RemoteCluster.deregister($scope.cluster.cluster_name).then(function() {
            $location.path('/remoteClusters');
          });
        });
    })
    .catch(function(data) {
      console.log(data);
    });
  };

  $scope.editRemoteCluster = function () {
    $scope.form.submitted = true;
    if ($scope.form.$valid){
      var payload = {
        "ClusterInfo" :{
          "cluster_id" : $scope.cluster.cluster_id,
          "name" : $scope.cluster.cluster_name,
          "url" : $scope.cluster.cluster_url,
          "username" : $scope.cluster.cluster_user
        }
      };

      var config = {
        headers : {
          'X-Requested-By': 'Ambari;'
        }
      }

      RemoteCluster.edit(payload, config).then(function(data) {
          Alert.success($t('views.alerts.savedRemoteClusterInformation'));
          $scope.form.$setPristine();
        })
        .catch(function(resp) {
          console.log(resp);
          Alert.error(resp.data.message);
        });
    }
  };

  $scope.cancel = function () {
    $scope.editVersionDisabled = true;
    $location.path('/remoteClusters');
  };

  // Fetch remote cluster details
  $scope.fetchRemoteClusterDetails = function (clusterName) {

    RemoteCluster.getDetails(clusterName).then(function(response) {
        $scope.cluster.cluster_id = response.ClusterInfo.cluster_id;
        $scope.cluster.cluster_name = response.ClusterInfo.name;
        $scope.cluster.cluster_url = response.ClusterInfo.url;
        $scope.cluster.cluster_user = response.ClusterInfo.username;
      })
      .catch(function(data) {
        console.log(data);
      });

  };

  $scope.fetchRemoteClusterDetails($routeParams.clusterName);


}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.directive('linkTo', function() {
  return {
    restrict: 'E',
    transclude: true,
    replace: true,
    scope: {
      route: '@',
      id: '@'
    },

    template: '<a ng-href="#{{href}}" ng-transclude></a>',
    controller: ['$scope', 'ROUTES', function($scope, ROUTES) {
      var route = ROUTES;
      angular.forEach($scope.route.split('.'), function(routeObj) {
        route = route[routeObj];
      });
      $scope.href = route.url.replace(':id', $scope.id);
    }]
  };
});
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.directive('passwordVerify', function() {
  return {
    require: 'ngModel',
    restrict: 'A',
    scope: {
      passwordVerify: '='
    },
    link: function(scope, elem, attrs, ctrl) {
      scope.$watch(function() {
        return (ctrl.$pristine && angular.isUndefined(ctrl.$modelValue)) || scope.passwordVerify === ctrl.$modelValue;
      }, function(currentValue) {
        ctrl.$setValidity('passwordVerify', currentValue);
      })
    }
  }
});
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.directive('disabledTooltip', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs, ctrl) {
      if(!attrs.ngDisabled){
        return;
      }
      scope.$watch(function(scope) {
        return scope[attrs.ngDisabled];
      }, function(val) {
        if(val){
          elem.tooltip({
            title: attrs.disabledTooltip
          });
        } else {
          elem.tooltip('destroy');
        }
      });
    }
  };
});
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.directive('editableList', ['$q', '$document', '$location', function($q, $document, $location) {
  return {
    restrict: 'E',
    templateUrl: 'views/directives/editableList.html',
    scope: {
      itemsSource: '=',
      resourceType: '@',
      editable: '='
    },
    link: function($scope, $elem, $attr, $ctrl) {
      var $editBox = $elem.find('[contenteditable]');

      var readInput = function() {
        $scope.$apply(function() {
          $scope.input = $editBox.text();
        });
      };

      var isIE = function () {
        var ua = window.navigator.userAgent;
        var msie = ua.indexOf("MSIE ");

        // If Internet Explorer, return version number
        if (msie > 0)
          return !!parseInt(ua.substring(msie + 5, ua.indexOf(".", msie)));

        // If Internet Explorer 11 handling differently because UserAgent string updated by Microsoft
        else if (!!navigator.userAgent.match(/Trident\/7\./))
          return true;
        else
        //If another browser just returning  0
          return false
      };

      $scope.$watch(function() {
        return $scope.input;
      }, function(newValue) {
        if(newValue === ''){
          $scope.clearInput();
        }
      });

      $scope.clearInput = function() {
        $editBox.html('').blur();
      };

      $scope.focusOnInput = function() {
        setTimeout(function() {
          var elem = $editBox[0];
          var selection = window.getSelection(),
              range = document.createRange();
          elem.innerHTML = '\u00a0';
          range.selectNodeContents(elem);

          if(!isIE())
            selection.removeAllRanges();

          selection.addRange(range);
          document.execCommand('delete', false, null);
        }, 0);
      };

      if(isIE()) {
        $editBox.keypress(function(e) {
          $scope.$apply(function() {
            $scope.input = $editBox.text() + e.char;
          })
        });
      }else{
        $editBox.on('input', readInput);
      }

      $editBox.on('keydown', function(e) {
        switch(e.which){
          case 27: // ESC
            $editBox.html('').blur();
            readInput();
            break;
          case 13: // Enter
            $scope.$apply(function() {
              if ($scope.addItem()) {
                $scope.focusOnInput();
              }
            });
            return false;
            break;
          case 40: // Down arrow
            $scope.downArrowHandler();
            break;
          case 38: // Up arrow
            $scope.upArrowHandler();
            break;
        }
      });

      $elem.find('.editable-list-container').on('reset', function(event) {
        $scope.editMode = false;
        $scope.items = angular.copy($scope.itemsSource);
        $scope.input = '';
        event.stopPropagation();
      });
    },
    controller: ['$scope', '$injector', '$modal', function($scope, $injector, $modal) {
      var $resource = $injector.get($scope.resourceType);

      $scope.identity = angular.identity; // Sorting function

      $scope.items = angular.copy($scope.itemsSource);
      $scope.editMode = false;
      $scope.input = '';
      $scope.typeahead = [];
      $scope.selectedTypeahed = 0;
      $scope.resources = [];
      $scope.invalidInput = false;

      preloadResources();

      // Watch source of items
      $scope.$watch(function() {
        return $scope.itemsSource;
      }, function(newValue) {
        $scope.items = angular.copy($scope.itemsSource);
      }, true);

      // When input has changed - load typeahead items
      $scope.$watch(function() {
        return $scope.input;
      }, function(newValue) {
        $scope.invalidInput = false;
        if(newValue){
          var newValue = newValue.split(',').filter(function(i){ 
            i = i.replace('&nbsp;', ''); // Sanitize from spaces
            return !!i.trim();
          }).map(function(i) { return i.trim(); });
          if( newValue.length > 1){
            var validInput = true;
            // If someone paste coma separated string, then just add all items to list
            angular.forEach(newValue, function(item) {
              if (validInput) {
                validInput = $scope.addItem(item);
              }
            });
            if (validInput) {
              $scope.clearInput();
              $scope.focusOnInput();
            }
          } else {
            var items = [];
            angular.forEach($scope.resources, function (name) {
              if (name.indexOf(newValue) !== -1 && $scope.items.indexOf(name) === -1) {
                items.push(name);
              }
            });
            $scope.typeahead = items.slice(0, 5);
            $scope.selectedTypeahed = 0;
          }
        } else {
          $scope.typeahead = [];
          $scope.selectedTypeahed = 0;
          $scope.focusOnInput();
        }
      });

      function preloadResources() {
        $resource.listByName('').then(function(data) {
          if (data && data.data.items) {
            $scope.resources = data.data.items.map(function(item) {
              if ($scope.resourceType === 'User') {
                return item.Users.user_name;
              } else if ($scope.resourceType === 'Group') {
                return item.Groups.group_name;
              }
            });
          }
        });
      }

      $scope.enableEditMode = function(event) {
        if( $scope.editable && !$scope.editMode){
          //only one editable-list could be in edit mode at once
          $('.cluster-manage-access-pane div.edit-mode').trigger('reset');
          $scope.editMode = true;
          $scope.focusOnInput();
        }
        event.stopPropagation();
      };

      $scope.cancel = function(event) {
        $scope.editMode = false;
        $scope.items = angular.copy($scope.itemsSource);
        $scope.input = '';
        event.stopPropagation();
      };
      $scope.save = function(event) {
        var validInput = true;
        if( $scope.input ){
          validInput = $scope.addItem($scope.input);
        }
        if (validInput) {
          $scope.itemsSource = $scope.items;
          $scope.editMode = false;
          $scope.input = '';
        }
        if(event){
          event.stopPropagation();
        }
      };


      $scope.downArrowHandler = function() {
        $scope.$apply(function() {
          $scope.selectedTypeahed = ($scope.selectedTypeahed+1) % $scope.typeahead.length;
        });
      };
      $scope.upArrowHandler = function() {
        $scope.$apply(function() {
          $scope.selectedTypeahed -= 1;
          $scope.selectedTypeahed = $scope.selectedTypeahed < 0 ? $scope.typeahead.length-1 : $scope.selectedTypeahed;
        });
      };

      $scope.addItem = function(item) {
        item = item ? item : $scope.typeahead.length ? $scope.typeahead[$scope.selectedTypeahed] : $scope.input;
        
        if (item && $scope.items.indexOf(item) === -1){
          if ($scope.resources.indexOf(item) !== -1) {
            $scope.items.push(item);
            $scope.input = '';
          } else {
            $scope.invalidInput = true;
            return false;
          }
        }
        return true;
      };

      $scope.removeFromItems = function(item) {
        $scope.items.splice( $scope.items.indexOf(item), 1);
      };

      $scope.$on('$locationChangeStart', function(event, targetUrl) {
        targetUrl = targetUrl.split('#').pop();
        if( $scope.input ){
          $scope.addItem($scope.input);
        }
        if( $scope.editMode && !angular.equals($scope.items, $scope.itemsSource)){
          var modalInstance = $modal.open({
            template: '<div class="modal-header"><h3 class="modal-title">{{"common.warning" | translate}}</h3></div><div class="modal-body">{{"common.alerts.unsavedChanges" | translate}}</div><div class="modal-footer"><div class="btn btn-default" ng-click="cancel()">{{"common.controls.cancel" | translate}}</div><div class="btn btn-warning" ng-click="discard()">{{"common.controls.discard" | translate}}</div><div class="btn btn-primary" ng-click="save()">{{"common.controls.save" | translate}}</div></div>',
            controller: ['$scope', '$modalInstance', function($scope, $modalInstance) {
              $scope.save = function() {
                $modalInstance.close('save');
              };
              $scope.discard = function() {
                $modalInstance.close('discard');
              };
              $scope.cancel = function() {
                $modalInstance.close('cancel');
              };
            }]
          });
          modalInstance.result.then(function(action) {
            switch(action){
              case 'save':
                $scope.save();
                break;
              case 'discard':
                $scope.editMode = false;
                $location.path(targetUrl);
                break;
            }
          });
          event.preventDefault();
        }
      });
    }]
  };
}]);


/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';


/**
 *  Example:
 *  <combo-search suggestions="filters"
 *                filter-change="filterItems"
 *                placeholder="Search"
 *                supportCategories="true">
 *  </combo-search>
 *
 *  filters = [
 *    {
 *      key: 'property1',
 *      label: $t('propertyLabel'),
 *      category: 'category1'
 *      options: []
 *    }
 *  ]
 *  Note: "category" field is optional, should be used only when supportCategories="true"
 *
 */

angular.module('ambariAdminConsole')
.directive('comboSearch', function() {
  return {
    restrict: 'E',
    templateUrl: 'views/directives/comboSearch.html',
    scope: {
      suggestions: '=',
      filterChange: '=',
      placeholder: '@',
      supportCategories: '@'
    },
    controller: ['$scope', function($scope) {
      return {
        suggestions: $scope.suggestions,
        placeholder: $scope.placeholder,
        filterChange: $scope.filterChange,
        supportCategories: $scope.supportCategories === "true"
      }
    }],
    link: function($scope, $elem, $attr, $ctrl) {
      var idCounter = 1;
      var suggestions = $ctrl.suggestions;
      var supportCategories = $ctrl.supportCategories;
      var mainInputElement = $elem.find('.main-input.combo-search-input');
      $scope.placeholder = $ctrl.placeholder;
      $scope.searchFilterInput = '';
      $scope.filterSuggestions = [];
      $scope.showAutoComplete = false;
      $scope.appliedFilters = [];

      attachInputWidthSetter(mainInputElement);
      initKeyHandlers();
      initBlurHandler();

      $scope.$watch(function () {
        return $scope.appliedFilters.length;
      }, function () {
        attachInputWidthSetter($elem.find('.combo-search-input'));
      });

      $scope.removeFilter = function(filter) {
        $scope.appliedFilters = $scope.appliedFilters.filter(function(item) {
          return filter.id !== item.id;
        });
        $scope.observeSearchFilterInput();
        mainInputElement.focus();
        $scope.updateFilters($scope.appliedFilters);
      };

      $scope.clearFilters = function() {
        $scope.appliedFilters = [];
        $scope.updateFilters($scope.appliedFilters);
      };

      $scope.selectFilter = function(filter, event) {
        var newAppliedFilter = {
          id: 'filter_' + idCounter++,
          currentOption: null,
          filteredOptions: [],
          searchOptionInput: '',
          key: filter.key,
          label: filter.label,
          options: filter.options || [],
          showAutoComplete: false
        };
        $scope.appliedFilters.push(newAppliedFilter);
        if (event) {
          event.stopPropagation();
          event.preventDefault();
        }
        $scope.isEditing = false;
        $scope.showAutoComplete = false;
        $scope.searchFilterInput = '';
        _.debounce(function() {
          $('input[name=' + newAppliedFilter.id + ']').focus().width(4);
        }, 100)();
      };

      $scope.selectOption = function(event, option, filter) {
        $('input[name=' + filter.id + ']').val(option.label).trigger('input');
        filter.showAutoComplete = false;
        mainInputElement.focus();
        $scope.observeSearchFilterInput(event);
        filter.currentOption = option;
        $scope.updateFilters($scope.appliedFilters);
      };

      $scope.hideAutocomplete = function(filter) {
        _.debounce(function() {
          if (filter) {
            filter.showAutoComplete = false;
          } else {
            if (!$scope.isEditing) {
              $scope.showAutoComplete = false;
            }
          }
          $scope.$apply();
        }, 100)();
      };

      $scope.forceFocus = function(event, filter) {
        $(event.currentTarget).find('.combo-search-input').focus();
        $scope.showAutoComplete = false;
        $scope.observeSearchOptionInput(filter);
        event.stopPropagation();
        event.preventDefault();
      };

      $scope.makeActive = function(active, all) {
        if (active.isCategory) {
          return false;
        }
        all.forEach(function(item) {
          item.active = active.key === item.key;
        });
      };

      $scope.observeSearchFilterInput = function(event) {
        if (event) {
          mainInputElement.focus();
          $scope.isEditing = true;
          event.stopPropagation();
          event.preventDefault();
        }

        var filteredSuggestions = suggestions.filter(function(item) {
          return (!$scope.searchFilterInput || item.label.toLowerCase().indexOf($scope.searchFilterInput.toLowerCase()) !== -1);
        });
        if (filteredSuggestions.length > 0) {
          $scope.makeActive(filteredSuggestions[0], filteredSuggestions);
          $scope.showAutoComplete = true;
        } else {
          $scope.showAutoComplete = false;
        }
        $scope.filterSuggestions = supportCategories ? formatCategorySuggestions(filteredSuggestions) : filteredSuggestions;
      };

      $scope.observeSearchOptionInput = function(filter) {
        var appliedOptions = {};
        $scope.appliedFilters.forEach(function(item) {
          if (item.key === filter.key && item.currentOption) {
            appliedOptions[item.currentOption.key] = true;
          }
        });

        if (filter.currentOption && filter.currentOption.key !== filter.searchOptionInput) {
          filter.currentOption = null;
        }
        filter.filteredOptions = filter.options.filter(function(option) {
          return !(option.key === '' || option.key === undefined || appliedOptions[option.key])
            && (!filter.searchOptionInput || option.label.toLowerCase().indexOf(filter.searchOptionInput.toLowerCase()) !== -1);
        });
        resetActive(filter.filteredOptions);
        filter.showAutoComplete = filter.filteredOptions.length > 0;
      };

      $scope.extractFilters = function(filters) {
        var map = {};
        var result = [];

        filters.forEach(function(filter) {
          if (filter.currentOption) {
            if (!map[filter.key]) {
              map[filter.key] = [];
            }
            map[filter.key].push(filter.currentOption.key);
          }
        });
        for(var key in map) {
          result.push({
            key: key,
            values: map[key]
          });
        }
        return result;
      };

      $scope.updateFilters = function(appliedFilters) {
        $ctrl.filterChange($scope.extractFilters(appliedFilters));
      };

      function formatCategorySuggestions(suggestions) {
        var categories = {};
        var result = [];
        suggestions.forEach(function(item) {
          if (!item.category) {
            item.category = 'default';
          }
          if (!categories[item.category]) {
            categories[item.category] = [];
          }
          categories[item.category].push(item);
        });

        for(var cat in categories) {
          result.push({
            key: cat,
            label: cat,
            isCategory: true,
            isDefault: cat === 'default'
          });
          result = result.concat(categories[cat]);
        }
        return result;
      }

      function initBlurHandler() {
        $(document).click(function() {
          $scope.isEditing = false;
          $scope.hideAutocomplete();
        });
      }

      function findActiveByName(array, name) {
        for (var i = 0; i < array.length; i++) {
          if (array[i].id === name) {
            return i;
          }
        }
        return null;
      }

      function findActiveByProperty(array) {
        for (var i = 0; i < array.length; i++) {
          if (array[i].active) {
            return i;
          }
        }
        return -1;
      }

      function resetActive(array) {
        array.forEach(function(item) {
          item.active = false;
        });
      }

      function focusInput(filter) {
        $('input[name=' + filter.id + ']').focus();
        $scope.showAutoComplete = false;
        $scope.observeSearchOptionInput(filter);
      }

      function initKeyHandlers() {
        $($elem).keydown(function(event) {
          if (event.which === 13) { // "Enter" key
            enterKeyHandler();
            $scope.$apply();
          }
          if (event.which === 8) { // "Backspace" key
            backspaceKeyHandler(event);
            $scope.$apply();
          }
          if (event.which === 38) { // "Up" key
            upKeyHandler();
            $scope.$apply();
          }
          if (event.which === 40) { // "Down" key
            downKeyHandler();
            $scope.$apply();
          }
          if (event.which === 39) { // "Right Arrow" key
            rightArrowKeyHandler();
            $scope.$apply();
          }
          if (event.which === 37) { // "Left Arrow" key
            leftArrowKeyHandler();
            $scope.$apply();
          }
          if (event.which === 27) { // "Escape" key
            $scope.showAutoComplete = false;
            $scope.$apply();
          }
        });
      }

      function leftArrowKeyHandler() {
        var activeElement = $(document.activeElement);
        if (activeElement.is('input') && activeElement[0].selectionStart === 0 && $scope.appliedFilters.length > 0) {
          if (activeElement.hasClass('main-input')) {
            focusInput($scope.appliedFilters[$scope.appliedFilters.length - 1]);
          } else {
            var activeIndex = findActiveByName($scope.appliedFilters, activeElement.attr('name'));
            if (activeIndex !== null && activeIndex > 0) {
              focusInput($scope.appliedFilters[activeIndex - 1]);
            }
          }
        }
      }

      function rightArrowKeyHandler() {
        var activeElement = $(document.activeElement);
        if (activeElement.is('input') && activeElement[0].selectionStart === activeElement.val().length) {
          if (!activeElement.hasClass('main-input')) {
            var activeIndex = findActiveByName($scope.appliedFilters, activeElement.attr('name'));
            if (activeIndex !== null) {
              if (activeIndex === $scope.appliedFilters.length - 1) {
                mainInputElement.focus();
                $scope.observeSearchFilterInput();
              } else {
                focusInput($scope.appliedFilters[activeIndex + 1]);
              }
            }
          }
        }
      }

      function downKeyHandler() {
        var activeIndex = 0;
        var nextIndex = null;

        if ($scope.showAutoComplete) {
          activeIndex = findActiveByProperty($scope.filterSuggestions);
          if (activeIndex < $scope.filterSuggestions.length - 1) {
            if ($scope.filterSuggestions[activeIndex + 1].isCategory && activeIndex + 2 < $scope.filterSuggestions.length) {
              nextIndex = activeIndex + 2;
            } else {
              nextIndex = activeIndex + 1;
            }
          } else {
            nextIndex = ($scope.filterSuggestions[0].isCategory) ? 1 : 0;
          }
          if (nextIndex !== null) {
            $scope.makeActive($scope.filterSuggestions[nextIndex], $scope.filterSuggestions);
          }
        } else {
          var activeAppliedFilters = $scope.appliedFilters.filter(function(item) {
            return item.showAutoComplete;
          });
          if (activeAppliedFilters.length > 0) {
            var filteredOptions = activeAppliedFilters[0].filteredOptions;
            activeIndex = findActiveByProperty(filteredOptions);
            if (activeIndex < filteredOptions.length - 1) {
              nextIndex = activeIndex + 1;
            } else {
              //switch to input of option
              nextIndex = null;
              resetActive(filteredOptions);
              focusInput(activeAppliedFilters[0]);
            }
          }
          if (nextIndex !== null) {
            $scope.makeActive(filteredOptions[nextIndex], filteredOptions);
          }
        }
      }

      function upKeyHandler() {
        var activeIndex = 0;
        var nextIndex = null;

        if ($scope.showAutoComplete) {
          activeIndex = findActiveByProperty($scope.filterSuggestions);
          if (activeIndex > 0) {
            if ($scope.filterSuggestions[activeIndex - 1].isCategory) {
              nextIndex = (activeIndex - 2 > 0) ? activeIndex - 2 : $scope.filterSuggestions.length - 1;
            } else {
              nextIndex = activeIndex - 1;
            }
          } else {
            nextIndex = $scope.filterSuggestions.length - 1;
          }
          if (nextIndex !== null) {
            $scope.makeActive($scope.filterSuggestions[nextIndex], $scope.filterSuggestions);
          }
        } else {
          var activeAppliedFilters = $scope.appliedFilters.filter(function(item) {
            return item.showAutoComplete;
          });
          if (activeAppliedFilters.length > 0) {
            var filteredOptions = activeAppliedFilters[0].filteredOptions;
            activeIndex = findActiveByProperty(filteredOptions);
            if (activeIndex > 0) {
              nextIndex = activeIndex - 1;
            } else if (activeIndex === 0) {
              //switch to input of option
              nextIndex = null;
              resetActive(filteredOptions);
              focusInput(activeAppliedFilters[0]);
            } else {
              nextIndex = filteredOptions.length - 1;
            }
          }
          if (nextIndex !== null) {
            $scope.makeActive(filteredOptions[nextIndex], filteredOptions);
          }
        }
      }

      function enterKeyHandler() {
        if ($scope.showAutoComplete) {
          var activeFilters = $scope.filterSuggestions.filter(function(item) {
            return item.active;
          });
          if (activeFilters.length > 0) {
            $scope.selectFilter(activeFilters[0]);
          }
        } else {
          var activeAppliedFilters = $scope.appliedFilters.filter(function(item) {
            return item.showAutoComplete;
          });
          if (activeAppliedFilters.length > 0) {
            var activeOptions = activeAppliedFilters[0].filteredOptions.filter(function(item) {
              return item.active;
            });
            if (activeOptions.length > 0) {
              $scope.selectOption(null, activeOptions[0], activeAppliedFilters[0]);
            }
          }
          if (activeAppliedFilters.length === 0 || activeOptions.length === 0) {
            $scope.appliedFilters.filter(function(item) {
              return !item.currentOption;
            }).forEach(function(item) {
              if (item.searchOptionInput !== '') {
                $scope.selectOption(null, {
                  key: item.searchOptionInput,
                  label: item.searchOptionInput
                }, item);
              }
            });
          }
        }
      }

      function backspaceKeyHandler (event) {
        if ($(document.activeElement).is('input') && $(document.activeElement)[0].selectionStart === 0) {
          if ($(document.activeElement).hasClass('main-input') && $scope.appliedFilters.length > 0) {
            var lastFilter = $scope.appliedFilters[$scope.appliedFilters.length - 1];
            focusInput(lastFilter);
            event.stopPropagation();
            event.preventDefault();
          } else {
            var name = $(document.activeElement).attr('name');
            var activeFilter = $scope.appliedFilters.filter(function(item) {
              return name === item.id;
            })[0];
            if (activeFilter) {
              $scope.removeFilter(activeFilter);
            }
          }
        }
      }

      function attachInputWidthSetter(element) {
        var textPadding = 4;
        element.on('input', function() {
          var inputWidth = $(this).textWidth();
          $(this).css({
            width: inputWidth + textPadding
          })
        }).trigger('input');
      }
    }
  };
});

$.fn.textWidth = function(text, font) {
  if (!$.fn.textWidth.fakeEl) $.fn.textWidth.fakeEl = $('<span>').hide().appendTo(document.body);
  $.fn.textWidth.fakeEl.text(text || this.val() || this.text() || this.attr('placeholder')).css('font', font || this.css('font'));
  return $.fn.textWidth.fakeEl.width();
};

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';
/**
 * This service should be used to keep all utility functions in one place that can be used in any controller
 */
angular.module('ambariAdminConsole')
  .factory('Utility', ['$injector', 'Settings', function ($injector, Settings) {
    return {
      /**
       *  if version1>= version2 then return true
       *     version1 < version2 then return false
       * @param version1 {String}
       * @param version2 {String}
       * @return boolean
       */
      compareVersions: function(version1, version2) {
        version1 = version1 || '0';
        version2 = version2 || '0';
        var version1Arr = version1.split('.').map(function(item){
          return parseInt(item);
        }).filter(function(item){
          return !!item || item === 0;
        });
        var version2Arr = version2.split('.').map(function(item){
          return parseInt(item);
        }).filter(function(item){
          return !!item || item === 0;
        });
        var totalLength = Math.max(version1Arr.length, version2Arr.length);
        var result = true, i;
        for (i = 0; i <=totalLength; i++) {
          if (version2Arr[i] === undefined) {
            // Example: version1 = "2.3.2.2" and version2 = 2.3.2
            result = true;
            break;
          } else if (version1Arr[i] === undefined) {
            // Example: version1 = "2.3.2" and version2 = "2.3.2.2"
            result = false;
            break;
          } else if (version1Arr[i] > version2Arr[i]) {
            // Example: version1 = "2.3.2.2" and version2 = "2.3.2.1"
            result = true;
            break;
          } else if (version1Arr[i] < version2Arr[i]) {
            // Example: version1 = "2.3.1.2" and version2 = "2.3.2.1"
            result = false;
            break;
          }
        }
        return result;
      },

      getUserPref: function (key) {
        return $injector.get('$http').get(Settings.baseUrl + '/persist/' + key);
      },

      postUserPref: function (key, value) {
        var deferred = $injector.get('$q').defer();
        $injector.get('$rootScope').authDataLoad.promise.then(function (canPersistData) {
          if (canPersistData) {
            var keyValuePair = {};
            keyValuePair[key] = JSON.stringify(value);
            $injector.get('$http').post(Settings.baseUrl + '/persist/', JSON.stringify(keyValuePair)).then(function () {
              deferred.resolve();
            }, function () {
              deferred.reject();
            });
          } else {
            deferred.reject();
          }
        });
        return deferred.promise;
      }
    };
  }
]);
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole').constant('UserConstants', {
  /**
   * Available user_types 'values' and 'labels' map.
   */
  TYPES: {
    LOCAL: {
      VALUE: 'LOCAL',
      LABEL_KEY: 'common.local'
    },
    PAM: {
      VALUE: 'PAM',
      LABEL_KEY: 'common.pam'
    },
    LDAP: {
      VALUE: 'LDAP',
      LABEL_KEY: 'common.ldap'
    },
    JWT: {
      VALUE: 'JWT',
      LABEL_KEY: 'common.jwt'
    }
  }
});

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.factory('User', ['Restangular', '$http', 'Settings', 'UserConstants', '$translate', 'Cluster', 'Auth', function(Restangular, $http, Settings, UserConstants, $translate, Cluster, Auth) {
  Restangular.addResponseInterceptor(function(data, operation, what, url, response, deferred) {
    var extractedData;
    if(operation === 'getList'){
      extractedData = data.items;
      extractedData.itemTotal = data.itemTotal;
    } else {
      extractedData = data;
    }

    return extractedData;
  });
  var $t = $translate.instant;

  return {
    list: function() {
      return $http.get(Settings.baseUrl + '/users?fields=Users/*,privileges/*');
    },
    listByName: function(name) {
      return $http.get(
        Settings.baseUrl + '/users?'
        + 'Users/user_name.matches(.*'+name+'.*)'
        + '&from=0&page_size=20'
      );
    },
    getWithRoles: function(userId) {
      return $http.get(
        Settings.baseUrl + '/users/' + userId
        + '?fields=privileges/PrivilegeInfo,Users'
      );
    },
    get: function(userId) {
      return Restangular.one('users', userId).get();
    },
    create: function(userObj) {
      return Restangular.all('users').post(userObj);
    },
    setActive: function(userId, isActive) {
      return Restangular.one('users', userId).customPUT({'Users/active':isActive});
    },
    setAdmin: function(userId, isAdmin) {
      return Restangular.one('users', userId).customPUT({'Users/admin':isAdmin});
    },
    setPassword: function(user, password, currentUserPassword) {
      return $http({
        method: 'PUT',
        url: Settings.baseUrl + '/users/' + user.user_name,
        data: {
          'Users/password': password,
          'Users/old_password': currentUserPassword
        }
      });
    },
    delete: function(userId) {
      return Restangular.one('users', userId).remove();
    },
    getPrivileges : function(userId) {
      return $http.get(Settings.baseUrl + '/users/' + userId + '/privileges', {
        params:{
          'fields': '*'
        }
      });
    },
    resetLoginFailures: function(userId) {
      return $http({
        method: 'PUT',
        url: Settings.baseUrl + '/users/' + userId,
        data: {
          'Users/consecutive_failures': 0
        }
      });
    },
    /**
     * Generate user info to display by response data from API.
     * Generally this is a single point to manage all required and useful data
     * needed to use as context for views/controllers.
     *
     * @param {Object} user - object from API response
     * @returns {Object}
     */
    makeUser: function(user) {
      user.Users.isDeletable = !(user.Users.user_name === Auth.getCurrentUser() || user.Users.user_type !== 'LOCAL');
      user.Users.encodedName = encodeURIComponent(user.Users.user_name);
      user.Users.userTypeName = $t(UserConstants.TYPES[user.Users.user_type].LABEL_KEY);
      user.Users.ldapUser = user.Users.user_type === UserConstants.TYPES.LDAP.VALUE;
      user.Users.roles = Cluster.sortRoles(user.privileges.filter(function(item) {
        return item.PrivilegeInfo.type === 'CLUSTER' || item.PrivilegeInfo.type === 'AMBARI';
      }).map(function(item) {
        return item.PrivilegeInfo;
      }));

      return user;
    }
  };
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.factory('Group', ['$http', '$q', 'Settings', '$translate', 'Cluster', function($http, $q, Settings, $translate, Cluster) {
  var $t = $translate.instant;
  var types = {
    LOCAL: {
      VALUE: 'LOCAL',
      LABEL_KEY: 'common.local'
    },
    PAM: {
      VALUE: 'PAM',
      LABEL_KEY: 'common.pam'
    },
    LDAP: {
      VALUE: 'LDAP',
      LABEL_KEY: 'common.ldap'
    }
  };

  function Group(item) {
    if (typeof item === 'string') {
      this.group_name = item;
    } else if (typeof item === 'object') {
      angular.extend(this, item.Groups);
    }
  }

  Group.prototype.save = function() {
    return $http({
      method : 'POST',
      url: Settings.baseUrl + '/groups',
      data:{
        'Groups/group_name': this.group_name
      }
    });
  };

  Group.prototype.destroy = function() {
    return $http.delete(Settings.baseUrl + '/groups/' +this.group_name);
  };

  Group.prototype.saveMembers = function() {
    var self = this;

    var members = [];
    angular.forEach(this.members, function(member) {
      members.push({
        'MemberInfo/user_name' : member,
        'MemberInfo/group_name' : self.group_name
      });
    });

    return $http({
      method: 'PUT',
      url: Settings.baseUrl + '/groups/' + this.group_name + '/members',
      data: members
    });
  };

  Group.removeMemberFromGroup = function(groupName, memberName) {
    return $http.delete(Settings.baseUrl + '/groups/'+groupName + '/members/'+memberName);
  };

  Group.addMemberToGroup = function(groupName, memberName) {
    return $http.post(Settings.baseUrl + '/groups/' + groupName + '/members/'+memberName);
  };

  Group.all = function() {
    var deferred = $q.defer();

    $http.get(Settings.baseUrl + '/groups?fields=*').then(
      function(resp) {
        deferred.resolve(resp.data.items);
      }, function(resp) {
        deferred.reject(resp.data);
      }
    );
    return deferred.promise;
  };

  Group.listByName = function(name) {
    return $http.get(Settings.baseUrl + '/groups?'
      + 'Groups/group_name.matches(.*'+name+'.*)'
    );
  };

  Group.getPrivileges = function(groupId) {
    return $http.get(Settings.baseUrl + '/groups/' + groupId + '/privileges', {
      params:{
        'fields': '*'
      }
    }).then(function (resp) {
      return resp.data;
    });
  };

  Group.get = function (group_name) {
    var deferred = $q.defer();
    $http({
      method: 'GET',
      url: Settings.baseUrl + '/groups/' + group_name +
      '?fields=Groups,privileges/PrivilegeInfo/*,members/MemberInfo'
    }).then(function (resp) {
      deferred.resolve(Group.makeGroup(resp.data));
    });

    return deferred.promise;
  };

  Group.getTypes = function () {
    return types;
  };

  /**
     * Generate group info to display by response data from API.
     * Generally this is a single point to manage all required and useful data
     * needed to use as context for views/controllers.
     *
     * @param {Object} group - object from API response
     * @returns {Object}
     */
  Group.makeGroup = function(data) {
    var group = new Group(data.Groups.group_name);
    group.groupTypeName = $t(types[data.Groups.group_type].LABEL_KEY);
    group.group_type = data.Groups.group_type;
    group.ldap_group = data.Groups.ldap_group;
    group.privileges = data.privileges;
    group.members = data.members;
    group.roles = Cluster.sortRoles(data.privileges.filter(function(item) {
      return item.PrivilegeInfo.type === 'CLUSTER' || item.PrivilegeInfo.type === 'AMBARI';
    }).map(function(item) {
      return item.PrivilegeInfo;
    }));
    return group;
  };

  return Group;
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
  .factory('RemoteCluster', ['$http', '$q', 'Settings', function($http, $q, Settings) {

    function RemoteCluster(){
    }

    RemoteCluster.edit = function(payload, config){
      return $http.put(Settings.baseUrl + '/remoteclusters/' + payload.ClusterInfo.name , payload, config);
    }


    RemoteCluster.getDetails = function(clusterName) {
      return $http.get( Settings.baseUrl  + '/remoteclusters/' + clusterName).then(function (resp) {
        return resp.data;
      });
    };

    RemoteCluster.deregister = function(clusterName){
      return $http.delete( Settings.baseUrl  + '/remoteclusters/' + clusterName);
    };

    RemoteCluster.register = function(payload, config){
      return $http.post(Settings.baseUrl + '/remoteclusters/' + payload.ClusterInfo.name , payload, config);
    }

    RemoteCluster.all = function() {
      return $http.get(Settings.baseUrl + "/remoteclusters").then(function (resp) {
        return resp.data;
      });
    };

    RemoteCluster.affectedViews = function(clustername) {
      return $http.get(Settings.baseUrl + '/views?'
        + 'fields=versions%2Finstances/ViewInstanceInfo/cluster_handle,versions%2Finstances/ViewInstanceInfo/cluster_type&versions%2FViewVersionInfo%2Fsystem=false&versions%2Finstances/ViewInstanceInfo/cluster_type=REMOTE_AMBARI&versions%2Finstances/ViewInstanceInfo/cluster_handle=' + clustername
      ).then(function (resp) {
        return resp.data;
      });
    };

    RemoteCluster.listAll = function() {
      var deferred = $q.defer();

      /* TODO :: Add params like RemoteCluster.matches and &from , &page_size */
      $http.get(Settings.baseUrl + "/remoteclusters?fields=ClusterInfo/services,ClusterInfo/cluster_id").then(
        function(resp) {
          deferred.resolve(resp.data.items);
        }, function(resp) {
          deferred.reject(resp.data);
        }
      );
      return deferred.promise;
    };

    return RemoteCluster;

  }]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.factory('View', ['$http', '$q', 'Settings', function($http, $q, Settings) {

  function ViewInstance(item){
    angular.extend(this, item);
  }



  ViewInstance.find = function(viewName, version, instanceName) {
    var deferred = $q.defer();
    var fields = [
      'privileges/PrivilegeInfo',
      'ViewInstanceInfo',
      'resources'
    ];

    $http({
      method: 'GET',
      url: Settings.baseUrl + '/views/'+viewName+'/versions/'+version+'/instances/'+instanceName,
      mock: 'view/views.json',
      params:{
        'fields': fields.join(',')
      }
    }).then(
      function(resp) {
        deferred.resolve(new ViewInstance(resp.data));
      }, function(resp) {
        deferred.reject(resp.data);
      }
    );
    return deferred.promise;
  };


  function ViewUrl(item) {
    angular.extend(this, item);
  }

  function URLStatus(item){
    angular.element(this,item);
  }

  ViewUrl.updateShortUrl = function(payload){
    var deferred = $q.defer();

    $http({
      method: 'POST',
      dataType: "json",
      url: Settings.baseUrl + '/view/urls/'+payload.ViewUrlInfo.url_name,
      data:payload
    }).then(
      function(data) {
        deferred.resolve(new URLStatus(data));
      }, function(data) {
        deferred.reject(data);
      }
    );
    return deferred.promise;
  };

  ViewUrl.deleteUrl = function(urlName){
    var deferred = $q.defer();

    $http({
      method: 'DELETE',
      dataType: "json",
      url: Settings.baseUrl + '/view/urls/'+ urlName,
    }).then(function(data) {
      deferred.resolve(new URLStatus(data));
    }, function(data) {
      deferred.reject(data);
    });

    return deferred.promise;
  };


  ViewUrl.editShortUrl = function(payload){
    var deferred = $q.defer();

    $http({
      method: 'PUT',
      dataType: "json",
      url: Settings.baseUrl + '/view/urls/'+payload.ViewUrlInfo.url_name,
      data:payload
    }).then(
      function(data) {
        deferred.resolve(new URLStatus(data));
      }, function(data) {
        deferred.reject(data);
      }
    );

    return deferred.promise;
  };


  ViewUrl.urlInfo =  function(urlName){

    var deferred = $q.defer();

    $http({
      method: 'GET',
      dataType: "json",
      url: Settings.baseUrl + '/view/urls/'+urlName,

    }).then(
      function(resp) {
        deferred.resolve(new ViewUrl(resp.data));
      }, function(resp) {
        deferred.reject(resp.data);
      }
    );

    return deferred.promise;
  };



  function View(item){
    var self = this;
    self.view_name = item.ViewInfo.view_name;
    self.versions = '';
    self.instances = [];
    self.canCreateInstance = false;
    var versions = {};
    angular.forEach(item.versions, function(version) {
      versions[version.ViewVersionInfo.version] = {count: version.instances.length, status: version.ViewVersionInfo.status};
      if (version.ViewVersionInfo.status === 'DEPLOYED'){ // if at least one version is deployed
        self.canCreateInstance = true;
      }

      angular.forEach(version.instances, function(instance) {
        instance.label = instance.ViewInstanceInfo.label || version.ViewVersionInfo.label || instance.ViewInstanceInfo.view_name;
      });

      self.instances = self.instances.concat(version.instances);
    });
    self.versions = versions;

    self.versionsList = item.versions;
  }

  View.permissionRoles = [
    "CLUSTER.ADMINISTRATOR",
    "CLUSTER.OPERATOR",
    "SERVICE.OPERATOR",
    "SERVICE.ADMINISTRATOR",
    "CLUSTER.USER"
  ];

  View.getInstance = function(viewName, version, instanceName) {
    return ViewInstance.find(viewName, version, instanceName);
  };

  View.getUrlInfo = function(urlName){
    return ViewUrl.urlInfo(urlName);
  };

  View.deleteUrl = function(urlName){
    return ViewUrl.deleteUrl(urlName);
  };


  View.updateShortUrl = function(payload){
    return ViewUrl.updateShortUrl(payload);
  };

  View.editShortUrl = function(payload){
    return ViewUrl.editShortUrl(payload);
  };

  View.deleteInstance = function(viewName, version, instanceName) {
    return $http.delete(Settings.baseUrl +'/views/'+viewName+'/versions/'+version+'/instances/'+instanceName, {
      headers: {
        'X-Requested-By': 'ambari'
      }
    });
  };

  View.updateInstance = function(viewName, version, instanceName, data) {
    return $http({
      method: 'PUT',
      url: Settings.baseUrl + '/views/' +viewName + '/versions/'+version+'/instances/' + instanceName,
      data: data
    });
  };

  View.getPermissions = function(params) {
    var deferred = $q.defer();

    var fields = [
      'permissions/PermissionInfo/permission_name'
    ];
    $http({
      method: 'GET',
      url: Settings.baseUrl + '/views/' + params.viewName + '/versions/'+ params.version,
      params: {
        'fields': fields.join(',')
      }
    }).then(function(resp) {
      deferred.resolve(resp.data.permissions);
    }, function(resp) {
      deferred.reject(resp.data);
    });

    return deferred.promise;
  };

  View.getPrivileges = function(params) {
    var deferred = $q.defer();

    $http({
      method: 'GET',
      url: Settings.baseUrl + '/views/' + params.viewName + '/versions/' + params.version + '/instances/' + params.instanceId,
      params: {
        fields: 'privileges/PrivilegeInfo'
      }
    }).then(
      function(resp) {
        deferred.resolve(resp.data.privileges);
      }, function(resp) {
        deferred.reject(resp.data);
      }
    );

    return deferred.promise;
  };



  View.getVersions = function(viewName) {
    var deferred = $q.defer();

    $http({
      method: 'GET',
      url: Settings.baseUrl + '/views/'+viewName + '?versions/ViewVersionInfo/status=DEPLOYED'
    }).then(
      function(resp) {
        var versions = [];
        angular.forEach(resp.data.versions, function(version) {
          versions.push(version.ViewVersionInfo.version);
        });

        deferred.resolve(versions);
      }, function(resp) {
        deferred.reject(resp.data);
      }
    );

    return deferred.promise;
  };

  View.createInstance = function(instanceInfo) {
    var properties = {},
      settings = {},
      data = {
        instance_name: instanceInfo.instance_name,
        label: instanceInfo.label,
        visible: instanceInfo.visible,
        icon_path: instanceInfo.icon_path,
        icon64_path: instanceInfo.icon64_path,
        description: instanceInfo.description
      };

    angular.forEach(instanceInfo.properties, function (property) {
      if (property.clusterConfig) {
        properties[property.name] = property.value
      } else {
        settings[property.name] = property.value
      }
    });

    data.properties = settings;
    data.cluster_type = instanceInfo.clusterType;

    if (instanceInfo.clusterId != null) {
      data.cluster_handle = instanceInfo.clusterId;
    } else {
      angular.extend(data.properties, properties);
    }

    return $http({
      method: 'POST',
      url: Settings.baseUrl + '/views/' + instanceInfo.view_name
      +'/versions/'+instanceInfo.version + '/instances/'+instanceInfo.instance_name,
      data:{
        'ViewInstanceInfo' : data
      }
    });
  };

  View.createPrivileges = function(params, data) {
    return $http({
      method: 'POST',
      url: Settings.baseUrl + '/views/' + params.view_name +'/versions/'+params.version+'/instances/'+params.instance_name+'/privileges',
      data: data
    });
  };

  View.deletePrivileges = function(params, data) {
    return $http({
      method: 'DELETE',
      url: Settings.baseUrl + '/views/' + params.view_name +'/versions/'+params.version+'/instances/'+params.instance_name+'/privileges',
      data: data
    });
  };

  View.updatePrivileges = function(params, privileges) {
    return $http({
      method: 'PUT',
      url: Settings.baseUrl + '/views/' + params.view_name +'/versions/'+params.version+'/instances/'+params.instance_name+'/privileges',
      data: privileges
    });
  };

  View.deletePrivilege = function(params) {
    return $http({
      method: 'DELETE',
      url: Settings.baseUrl + '/views/' + params.view_name +'/versions/'+params.version+'/instances/'+params.instance_name+'/privileges/'+params.id
    });
  };

  View.getMeta = function(view_name, version) {
    return $http({
      method: 'GET',
      url: Settings.baseUrl + '/views/'+view_name+'/versions/'+version
    });
  };

  View.checkViewVersionStatus = function(view_name, version) {
    var deferred = $q.defer();

    $http({
      method: 'GET',
      url: Settings.baseUrl + '/views/' + view_name + '/versions/' + version,
      params:{
        'fields': 'ViewVersionInfo/status'
      }
    }).then(function(resp) {
      deferred.resolve(resp.data.data.ViewVersionInfo.status);
    }, function(resp) {
      deferred.reject(resp.data);
    });

    return deferred;
  };

  View.getAllVisibleInstance = function() {
    var deferred = $q.defer();
    $http({
      method: 'GET',
      url: Settings.baseUrl + '/views',
      mock: 'view/views.json',
      params:{
        'fields': 'versions/instances/ViewInstanceInfo',
        'versions/ViewVersionInfo/system': false,
        'versions/instances/ViewInstanceInfo/visible': true
      }
    }).then(function(resp) {
      var instances = [];
      resp.data.items.forEach(function(view) {
        if (Array.isArray(view.versions)) {
          view.versions.forEach(function(version) {
            version.instances.forEach(function(instance) {
              instances.push(instance.ViewInstanceInfo);
            });
          });
        }
      });
      deferred.resolve(instances);
    });

    return deferred.promise;
  };

  View.all = function() {
    var deferred = $q.defer();
    var fields = [
      'versions/ViewVersionInfo/version',
      'versions/instances/ViewInstanceInfo',
      'versions/*'
    ];

    $http({
      method: 'GET',
      url: Settings.baseUrl + '/views',
      params:{
        'fields': fields.join(','),
        'versions/ViewVersionInfo/system' : false
      }
    }).then(
      function(resp) {
        var views = [];
        angular.forEach(resp.data.items, function(item) {
          views.push(new View(item));
        });
        deferred.resolve(views);
      }, function(resp) {
        deferred.reject(resp.data);
      }
    );

    return deferred.promise;
  };
  return View;
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.factory('Cluster', ['$http', '$q', 'Settings', '$translate', function($http, $q, Settings, $translate) {
  var $t = $translate.instant;
  var permissions = null;
  var rolesWithAuthorizations = null;

  return {
    repoStatusCache : {},

    orderedRoles : [
      'CLUSTER.ADMINISTRATOR',
      'CLUSTER.OPERATOR',
      'SERVICE.ADMINISTRATOR',
      'SERVICE.OPERATOR',
      'CLUSTER.USER'
    ],

    orderedLevels: ['SERVICE', 'HOST', 'CLUSTER', 'AMBARI'],

    ineditableRoles : ['VIEW.USER', 'AMBARI.ADMINISTRATOR'],

    sortRoles: function(roles) {
      var orderedRoles = ['AMBARI.ADMINISTRATOR'].concat(this.orderedRoles);
      return roles.sort(function(a, b) {
        return orderedRoles.indexOf(a.permission_name) - orderedRoles.indexOf(b.permission_name);
      });
    },

    getAllClusters: function() {
      var deferred = $q.defer();
      $http.get(Settings.baseUrl + '/clusters?fields=Clusters/cluster_id', {mock: 'cluster/clusters.json'})
      .then(function(resp) {
        deferred.resolve(resp.data.items);
      }, function(resp) {
        deferred.reject(resp.data);
      });

      return deferred.promise;
    },
    getStatus: function() {
      var deferred = $q.defer();

      $http.get(Settings.baseUrl + '/clusters?fields=Clusters/provisioning_state', {mock: 'cluster/init.json'})
      .then(function(resp) {
        deferred.resolve(resp.data.items[0]);
      }, function(resp) {
        deferred.reject(resp.data);
      });

      return deferred.promise;
    },
    getAmbariVersion: function() {
      var deferred = $q.defer();

      $http.get(Settings.baseUrl + '/services/AMBARI/components/AMBARI_SERVER?fields=RootServiceComponents/component_version,RootServiceComponents/properties/server.os_family&minimal_response=true', {mock: '2.1'})
      .then(function(resp) {
        deferred.resolve(resp.data.RootServiceComponents.component_version);
      }, function(resp) {
        deferred.reject(resp.data);
      });

      return deferred.promise;
    },
    getClusterOS: function() {
      var deferred = $q.defer();

      $http.get(Settings.baseUrl + '/services/AMBARI/components/AMBARI_SERVER?fields=RootServiceComponents/properties/server.os_family&minimal_response=true', {mock: 'redhat6'})
      .then(function(resp) {
        deferred.resolve(resp.data.RootServiceComponents.properties['server.os_family']);
      }, function(resp) {
        deferred.reject(resp.data);
      });

      return deferred.promise;
    },
    getAmbariTimeout: function() {
      var deferred = $q.defer();
      var url = '/services/AMBARI/components/AMBARI_SERVER?fields=RootServiceComponents/properties/user.inactivity.timeout.default';
      $http.get(Settings.baseUrl + url)
      .then(function(resp) {
        var properties = resp.data.RootServiceComponents.properties;
        var timeout = properties? properties['user.inactivity.timeout.default'] : 0;
        deferred.resolve(timeout);
      }, function(resp) {
        deferred.reject(resp.data);
      });

      return deferred.promise;
    },
    getPermissions: function() {
      var deferred = $q.defer();
      $http({
        method: 'GET',
        url: Settings.baseUrl + '/permissions',
        mock: 'permission/permissions.json',
        params: {
          fields: 'PermissionInfo',
          'PermissionInfo/resource_name': 'CLUSTER'
        }
      }).then(
        function(resp) {
          deferred.resolve(resp.data.items);
        }, function(resp) {
          deferred.reject(resp.data);
        }
      );
      return deferred.promise;
    },
    getRoleOptions: function () {
      var roleOptions = [];
      var deferred = $q.defer();
      var localDeferred = $q.defer();
      var promise = permissions ? localDeferred.promise : this.getPermissions();

      localDeferred.resolve(permissions);
      promise.then(function(data) {
        permissions = data;
        roleOptions = data.map(function(item) {
          return item.PermissionInfo;
        });
        roleOptions.unshift({
          permission_name: 'NONE',
          permission_label: $t('users.roles.none')
        });
      }).finally(function() {
        deferred.resolve(roleOptions);
      });
      return deferred.promise;
    },
    getRolesWithAuthorizations: function() {
      var deferred = $q.defer();
      if (rolesWithAuthorizations) {
        deferred.resolve(rolesWithAuthorizations);
      } else {
        $http({
          method: 'GET',
          url: Settings.baseUrl + '/permissions?PermissionInfo/resource_name.in(CLUSTER,AMBARI)',
          mock: 'permission/permissions.json',
          params: {
            fields: 'PermissionInfo/*,authorizations/AuthorizationInfo/*'
          }
        }).then(
          function (resp) {
            rolesWithAuthorizations = resp.data.items;
            deferred.resolve(resp.data.items);
          },function (resp) {
            deferred.reject(resp.data);
          }
        );
      }

      return deferred.promise;
    },

    getPrivileges: function(params) {
      var deferred = $q.defer();

      $http({
        method: 'GET',
        url: Settings.baseUrl + '/clusters/'+params.clusterId,
        params : {
          'fields': 'privileges/PrivilegeInfo'
        }
      }).then(
        function(resp) {
          deferred.resolve(resp.data.privileges);
        }, function(resp) {
          deferred.reject(resp.data);
        }
      );

      return deferred.promise;
    },
    getPrivilegesForResource: function(params) {
      var isUser = (params.typeFilter.value == 'USER');
      var endpoint = isUser ? '/users' : '/groups';
      var nameURL = isUser ? '&Users/user_name.matches(' : '&Groups/group_name.matches(';
      var nameFilter = params.nameFilter ? (nameURL + params.nameFilter + ')') : '';
      return $http({
        method : 'GET',
        url : Settings.baseUrl + endpoint + '?' + 'fields=privileges/PrivilegeInfo/*' + nameFilter
      }).then(function (resp) {
        return resp.data;
      });
    },
    createPrivileges: function(params, data) {
      return $http({
        method: 'POST',
        url: Settings.baseUrl + '/clusters/'+params.clusterId+'/privileges',
        data: data
      });
    },
    deletePrivileges: function(params, data) {
      return $http({
        method: 'DELETE',
        url: Settings.baseUrl + '/clusters/'+params.clusterId+'/privileges',
        data: data
      });
    },
    deleteMultiplePrivileges: function(clusterId, privilege_ids) {
      return $http({
        method: 'DELETE',
        url: Settings.baseUrl + '/clusters/'+clusterId+'/privileges?PrivilegeInfo/privilege_id.in\('+privilege_ids+'\)'
      });
    },
    updatePrivileges: function(params, privileges) {
      return $http({
        method: 'PUT',
        url: Settings.baseUrl + '/clusters/' + params.clusterId + '/privileges',
        data: privileges
      });
    },
    deletePrivilege: function(clusterId, id) {
      return $http({
        method: 'DELETE',
        url: Settings.baseUrl + '/clusters/'+clusterId+'/privileges/' + id
      });
    },
    editName: function(oldName, newName) {
      return $http({
        method: 'PUT',
        url: Settings.baseUrl + '/clusters/' + oldName,
        data: {
          Clusters: {
            "cluster_name": newName
          }
        }
      });
    },
    getBlueprint: function(params){
      var clusterName = params.clusterName;
      return $http({
        method: 'GET',
        url: Settings.baseUrl + '/clusters/' + clusterName + '?' + 'format=blueprint'
      }).then(function (resp) {
        return resp.data;
      });
    },
    getRepoVersionStatus: function (clusterName, repoId ) {
      var me = this;
      var deferred = $q.defer();
      var url = Settings.baseUrl + '/clusters/' + clusterName +
        '/stack_versions?fields=*&ClusterStackVersions/repository_version=' + repoId;
      $http.get(url, {mock: 'cluster/repoVersionStatus.json'}).then(
        function (resp) {
          var data = resp.data.items;
          var response = {};
          if (data.length > 0) {
            var hostStatus = data[0].ClusterStackVersions.host_states;
            var currentHosts = hostStatus['CURRENT'].length;
            var installedHosts = hostStatus['INSTALLED'].length;
            var totalHosts = 0;
            // collect hosts on all status
            angular.forEach(hostStatus, function(status) {
              totalHosts += status.length;
            });
            response.status = data[0].ClusterStackVersions.state;
            response.currentHosts = currentHosts;
            response.installedHosts = installedHosts;
            response.totalHosts = totalHosts;
            response.stackVersionId = data[0].ClusterStackVersions.id;
          } else {
            response.status = '';
          }
          me.repoStatusCache[repoId] = response.status;
          deferred.resolve(response);
        }, function (resp) {
          deferred.reject(resp.data);
        }
      );
      return deferred.promise;
    }
  };
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.factory('Alert', [function() {
  
  var hideTimeout = null;
  var $boxContainer = null;
  var removingTimeout = null;

  function createAlertBox(innerHTML, moreInfo, type){
    if (!$boxContainer) {
      $boxContainer = angular.element('<div class="alert-container"/>').appendTo('body');
      $boxContainer
        .on('mouseenter', function() {
          clearTimeout(removingTimeout);
        })
        .on('mouseleave', function() {
          startRemovingTimeout();
        });
    }
    var elem = angular.element('<div><div class="icon-box"></div></div>').addClass('ambariAlert').addClass(type).addClass('invisible');

    elem.append('<div class="content">' + innerHTML + '</div>');
    if (moreInfo) {
      $(' <a href class="more-collapse"> more...</a>').appendTo(elem.find('.content'))
      .on('click', function() {
        elem.find('.more').show();
        $(this).remove();
        return false;
      });
      elem.append('<div class="more">'+moreInfo.replace(/\./g, '.<wbr />')+'</div>');
    }

    $('<button type="button" class="close"><span aria-hidden="true">&times;</span><span class="sr-only">{{"common.controls.close" | translate}}</span></button>')
      .appendTo(elem)
      .on('click', function() {
        var $box = $(this).closest('.ambariAlert');
        $box.remove();
      });

    var $icon = $('<span class="glyphicon"></span>');
    switch (type){
      case 'error':
        $icon.addClass('glyphicon-remove-sign');
        break;
      case 'success':
        $icon.addClass('glyphicon-ok-sign');
        break;
      case 'info':
        $icon.addClass('glyphicon-info-sign');
        break;
    }
    elem.find('.icon-box').append($icon);

    elem.appendTo($boxContainer);
    setTimeout(function() {
      elem.removeClass('invisible');
    }, 0);

    startRemovingTimeout();
  };

  function startRemovingTimeout(){
    clearTimeout(removingTimeout);
    removingTimeout = setTimeout(removeTopBox, 5000);
  }

  function removeTopBox(){
    $boxContainer.children().first().remove();
    if (!$boxContainer.children().length) {
      $boxContainer.remove();
      $boxContainer = null;
    } else {
      startRemovingTimeout();
    }
  }

  return {
    error: function(innerHTML, moreInfo) {
      createAlertBox(innerHTML, moreInfo, 'error');
    },
    success: function(innerHTML, moreInfo) {
      createAlertBox(innerHTML, moreInfo, 'success');
    },
    info: function(innerHTML, moreInfo) {
      createAlertBox(innerHTML, moreInfo, 'info');
    }
  };
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.factory('PermissionLoader', ['Cluster', 'View', '$q', function(Cluster, View, $q) {
  
  function getPermissionsFor(resource, params){
    var deferred = $q.defer();

    resource.getPermissions(params).then(function(permissions) {
      var permissionsInner = {}; // Save object into closure, until it completely fills to prevent blinking
      angular.forEach(permissions, function(permission) {
        permission.GROUP = [];
        permission.USER = [];
        permission.ROLE = {};
        angular.forEach(View.permissionRoles, function(key) {
          permission.ROLE[key] = false;
        });
        permissionsInner[permission.PermissionInfo.permission_name] = permission;
      });

      // Now we can get privileges
      resource.getPrivileges(params).then(function(privileges) {
        angular.forEach(privileges, function(privilege) {
          if(privilege.PrivilegeInfo.principal_type == "ROLE") {
            permissionsInner[privilege.PrivilegeInfo.permission_name][privilege.PrivilegeInfo.principal_type][privilege.PrivilegeInfo.principal_name] = true;
          } else {
            permissionsInner[privilege.PrivilegeInfo.permission_name][privilege.PrivilegeInfo.principal_type].push(privilege.PrivilegeInfo.principal_name);
          }
        });

        // After all builded - return object
        deferred.resolve(permissionsInner);
      }).
      catch(function(data) {
        deferred.reject(data);
      });

    })
    .catch(function(data) {
      deferred.reject(data);
    });

    return deferred.promise;
  }

  return {
    getClusterPermissions: function(params) {
      return getPermissionsFor(Cluster, params);
    },
    getViewPermissions: function(params) {
      return getPermissionsFor(View, params);
    }
  };
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.factory('PermissionSaver', ['Cluster', 'View', '$q', 'getDifference', '$translate', function(Cluster, View, $q, getDifference, $translate) {
  var $t = $translate.instant;

  function savePermissionsFor(resource, permissions, params){
    var arr = [];
    angular.forEach(permissions, function(permission) {
      // Sanitaize input
      var users = permission.USER.toString().split(',').filter(function(item) {return item.trim();}).map(function(item) {return item.trim()});
      var groups = permission.GROUP.toString().split(',').filter(function(item) {return item.trim();}).map(function(item) {return item.trim()});
      // Build array
      arr = arr.concat(users.map(function(user) {
        return {
          'PrivilegeInfo':{
            'permission_name': permission.PermissionInfo.permission_name,
            'principal_name': user,
            'principal_type': 'USER'
          }
        }
      }));

      arr = arr.concat(groups.map(function(group) {
        return {
          'PrivilegeInfo':{
            'permission_name': permission.PermissionInfo.permission_name,
            'principal_name': group,
            'principal_type': 'GROUP'
          }
        }
      }));

      angular.forEach(View.permissionRoles, function(key) {
        if(permission.ROLE[key] === true) {
          arr.push({
            'PrivilegeInfo': {
              'permission_name': 'VIEW.USER',
              'principal_name': key,
              'principal_type': 'ROLE'
            }
          });
        }
      });

    });
    if (!passOneRoleCheck(arr)) {
      console.log($t('common.alerts.checkFailed'));
      var deferred = $q.defer();
      deferred.reject({
        data: {
          message: $t('users.roles.oneRolePerUserOrGroup')
        }
      });
      return deferred.promise;
    }
    return resource.updatePrivileges(params, arr);
  }

  function passOneRoleCheck(arr) {
    var hashes = {};
    for(var i = 0; i < arr.length; i++) {
      var obj = arr[i],
        type = obj.PrivilegeInfo.principal_type,
        name = obj.PrivilegeInfo.principal_name;
      if (!hashes[type]) {
        hashes[type] = {};
      }
      if (hashes[type][name] && name !== "*") {
        return false;
      } else {
        hashes[type][name] = true;
      }
    }
    return true;
  }

  return {
    saveClusterPermissions: function(permissions, params) {
      return savePermissionsFor(Cluster, permissions, params);
    },
    saveViewPermissions: function(permissions, params) {
      return savePermissionsFor(View, permissions, params);
    }
  };
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.factory('ConfirmationModal', ['$modal', '$q', '$translate', function($modal, $q, $translate) {

  var $t = $translate.instant;

	return {
		show: function(header, body, confirmText, cancelText, options) {
			var deferred = $q.defer();
      options = options || {};

			var modalInstance = $modal.open({
				templateUrl: 'views/modals/ConfirmationModal.html',
				controller: ['$scope', '$modalInstance', function($scope, $modalInstance) {
					$scope.header = header;
          $scope.isTempalte = !!body.url;
					$scope.body = body;
          $scope.innerScope = body.scope;
          $scope.confirmText = confirmText || $t('common.controls.ok');
          $scope.cancelText = cancelText || $t('common.controls.cancel');
          $scope.primaryClass = options.primaryClass || 'btn-primary',
					$scope.showCancelButton = !options.hideCancelButton;

					$scope.ok = function() {
						$modalInstance.close();
						deferred.resolve();
					};
					$scope.cancel = function() {
						$modalInstance.dismiss();
						deferred.reject();
					};
				}]
			});

      modalInstance.result.then(function() {
        // Gets triggered on close
      }, function() {
        // Gets triggered on dismiss
        deferred.reject();
      });

			return deferred.promise;
		}
	};
}]);
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.factory('DeregisterClusterModal', ['$modal', '$q', '$translate', function($modal, $q, $translate) {

  var $t = $translate.instant;

	return {
		show: function(header, body, remoteInstances, confirmText, cancelText ) {
			var deferred = $q.defer();

			var modalInstance = $modal.open({
				templateUrl: 'views/modals/DeregisterClusterModal.html',
				controller: ['$scope', '$modalInstance', function($scope, $modalInstance) {
					$scope.header = header;
          $scope.isTempalte = !!body.url;
					$scope.body = body;
          $scope.innerScope = body.scope;
          $scope.confirmText = confirmText || $t('common.controls.ok');
          $scope.cancelText = cancelText || $t('common.controls.cancel');
					$scope.remoteInstances = remoteInstances || [];

					$scope.ok = function() {
						$modalInstance.close();
						deferred.resolve();
					};
					$scope.cancel = function() {
						$modalInstance.dismiss();
						deferred.reject();
					};
				}]
			});

      modalInstance.result.then(function() {
        // Gets triggered on close
      }, function() {
        // Gets triggered on dismiss
        deferred.reject();
      });

			return deferred.promise;
		}
	};
}]);
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.factory('Auth',['$http', 'Settings', function($http, Settings) {
  var ambari;
  var currentUserName;
  if (localStorage.ambari) {
    ambari = JSON.parse(localStorage.ambari);
    if (ambari && ambari.app && ambari.app.loginName) {
      currentUserName = ambari.app.loginName;
    }
  }
  return {
    signout: function() {
      var data = JSON.parse(localStorage.ambari);
      delete data.app.authenticated;
      delete data.app.loginName;
      delete data.app.user;
      localStorage.ambari = JSON.stringify(data);
      // Workaround for sign off within Basic Authorization
      //commenting this out since using Date.now() in the url causes a security error in IE and does not log out user
      /*var origin = $window.location.protocol + '//' + Date.now() + ':' + Date.now() + '@' +
            $window.location.hostname + ($window.location.port ? ':' + $window.location.port : '');
      return $http({
        method: 'GET',
        url: origin + Settings.baseUrl + '/logout'
      });*/
      //use an invalid username and password in the request header
      $http.defaults.headers.common['Authorization'] = 'Basic ' + btoa('invalid_username:password');
      return $http({
        method: 'GET',
        url: Settings.baseUrl + '/logout'
      });
    },
    getCurrentUser: function() {
    	return currentUserName;
    }
  };
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.factory('getDifference', [function() {
	return function(oldArr, newArr) {
    var result = {
      add: [],
      del: []
    };
    angular.forEach(newArr, function(item) {
      var itemIndex = oldArr.indexOf(item);
      if(itemIndex >= 0){
        oldArr.splice(itemIndex, 1);
      } else {
        result.add.push(item);
      }
    });

    result.del = oldArr;

    return result;
  };
}]);
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.service('UnsavedDialog', ['$modal', function($modal) {

	return function(){
		var modalInstance = $modal.open({
      template: '<div class="modal-header"><h3 class="modal-title">{{"common.warning" | translate}}</h3></div><div class="modal-body">{{"common.alerts.unsavedChanges" | translate}}</div><div class="modal-footer"><div class="btn btn-default" ng-click="cancel()">{{"common.controls.cancel" | translate}}</div><div class="btn btn-warning" ng-click="discard()">{{"common.controls.discard" | translate}}</div><div class="btn btn-primary" ng-click="save()">{{"common.controls.save" | translate}}</div></div>',
      controller: ['$scope', '$modalInstance', function($scope, $modalInstance) {
        $scope.save = function() {
          $modalInstance.close('save');
        };
        $scope.discard = function() {
          $modalInstance.close('discard');
        };
        $scope.cancel = function() {
          $modalInstance.close('cancel');
        };
      }]
    });
    
    return modalInstance.result;
	};
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.factory('Stack', ['$http', '$q', 'Settings', '$translate', function ($http, $q, Settings,$translate) {
  var $t = $translate.instant,
    statusMap = {
      'INSTALLED': {
        label: $t('versions.installed'),
        class: 'label-default'
      },
      'IN_USE': {
        label: $t('versions.inUse'),
        class: 'label-info'
      },
      'CURRENT': {
        label: $t('versions.current'),
        class: 'label-success'
      }
  };
  /**
   * parse raw json to formatted objects
   * @param data
   * @return {Array}
   */
  function parse(data) {
    data.forEach(function (item) {
      var mapItem = statusMap[item.status];
      if (mapItem) {
        item.statusClass = mapItem.class;
        item.statusLabel = mapItem.label;
      }
    });
    return data;
  }


  function  _parseId(id) {
    return id.replace(/[^\d|\.]/g, '').split('.').map(function (i) {return parseInt(i, 10);});
  }

  return {
    allStackVersions: function () {
      var url = Settings.baseUrl + '/stacks?fields=versions/*';
      var deferred = $q.defer();
      var sortFunction = this.sortByIdAsVersion;
      $http.get(url, {mock: 'stack/allStackVersions.json'}).then(
        function (resp) {
          var data = resp.data;
          var allStackVersions = [];
          angular.forEach(data.items, function (stack) {
            angular.forEach(stack.versions, function (version) {
              var stack_name = version.Versions.stack_name;
              var stack_version = version.Versions.stack_version;
              var upgrade_packs = version.Versions.upgrade_packs;
              var active = version.Versions.active;
              allStackVersions.push({
                id: stack_name + '-' + stack_version,
                stack_name: stack_name,
                stack_version: stack_version,
                displayName: stack_name + '-' + stack_version,
                upgrade_packs: upgrade_packs,
                active: active
              });
            });
          });
          deferred.resolve(allStackVersions.sort(sortFunction));
        }, function (resp) {
          deferred.reject(resp.data);
        }
      );
      return deferred.promise;
    },

    getGPLLicenseAccepted: function() {
      var deferred = $q.defer();

      $http.get(Settings.baseUrl + '/services/AMBARI/components/AMBARI_SERVER?fields=RootServiceComponents/properties/gpl.license.accepted&minimal_response=true', {mock: 'true'})
        .then(function(resp) {
          deferred.resolve(resp.data.RootServiceComponents.properties && resp.data.RootServiceComponents.properties['gpl.license.accepted']);
        }, function(resp) {
          deferred.reject(resp.data);
        }
      );

      return deferred.promise;
    },
    
    allPublicStackVersions: function() {
      var self = this;
      var url = '/version_definitions?fields=VersionDefinition/stack_default,VersionDefinition/type,' +
        'VersionDefinition/stack_repo_update_link_exists,operating_systems/repositories/Repositories/*,' +
        'VersionDefinition/stack_services,VersionDefinition/repository_version&VersionDefinition/show_available=true';
      var deferred = $q.defer();
      $http.get(Settings.baseUrl + url, {mock: 'version/versions.json'}).then(
        function (resp) {
          var data = resp.data;
          var versions = [];
          angular.forEach(data.items, function(version) {
            var versionObj = {
              id: version.VersionDefinition.id,
              stackName: version.VersionDefinition.stack_name,
              stackVersion: version.VersionDefinition.stack_version,
              stackDefault: version.VersionDefinition.stack_default,
              stackRepoUpdateLinkExists: version.VersionDefinition.stack_repo_update_link_exists,
              stackNameVersion:  version.VersionDefinition.stack_name + '-' + version.VersionDefinition.stack_version,
              displayName: version.VersionDefinition.stack_name + '-' + version.VersionDefinition.repository_version.split('-')[0], //HDP-2.3.4.0
              displayNameFull: version.VersionDefinition.stack_name + '-' + version.VersionDefinition.repository_version, //HDP-2.3.4.0-23
              isNonXMLdata: true,
              repositoryVersion: version.VersionDefinition.repository_version,
              stackNameRepositoryVersion: version.VersionDefinition.stack_name + '-' + version.VersionDefinition.repository_version,
              showAvailable: version.VersionDefinition.show_available,
              osList: version.operating_systems,
              updateObj: version
            };
            self.setVersionNumberProperties(version.VersionDefinition.repository_version, versionObj);
            //hard code to not show stack name box for ECS stack
            if (isNaN(versionObj.editableDisplayName.charAt(0))) {
              versionObj.isNonXMLdata = false;
            }
            var services = [];
            angular.forEach(version.VersionDefinition.stack_services, function (service) {
              // services that should not be shown on UI
              var servicesToExclude = ['GANGLIA', 'KERBEROS', 'MAPREDUCE2'];
              if (servicesToExclude.indexOf(service.name) === -1) {
                services.push({
                  name: service.name,
                  displayName: service.display_name,
                  version: service.versions[0]
                });
              }
            });
            versionObj.services = services.sort(function(a, b){return a.name.localeCompare(b.name)});
            versionObj.osList.forEach(function (os) {
              os.repositories.forEach(function(repo) {
                repo.Repositories.initial_base_url = repo.Repositories.base_url;
                repo.Repositories.initial_repo_id = repo.Repositories.repo_id;
              });
            });
            versions.push(versionObj);
          });
          deferred.resolve(versions)
        }, function (resp) {
          deferred.reject(resp.data);
        }
      );
      return deferred.promise;
    },

    setVersionNumberProperties: function(version, versionObj) {
      var length = version.split(".").length;
      switch (length) {
        //when the stackVersion is single digit e.g. "2"
        case 1:
           versionObj.pattern = "(0.0.0)";
           versionObj.subVersionPattern = new RegExp(/^\d+\.\d+(-\d+)?\.\d+$/);
           versionObj.editableDisplayName = "";
           break;
        //when the stackVersion has two digits e.g. "2.5"
        case 2:
           versionObj.pattern = "(0.0)";
           versionObj.subVersionPattern = new RegExp(/^\d+\.\d+(-\d+)?$/);
           versionObj.editableDisplayName = version.substring(4);
           break;
        //when the stackVersion has three digits e.g. "2.5.1"
        case 3:
           versionObj.pattern = "(0)";
           versionObj.subVersionPattern = new RegExp(/^[0-9]\d*$/);
           versionObj.editableDisplayName = "";
           break;
        default:
           versionObj.pattern = "(0.0)";
           versionObj.subVersionPattern = new RegExp(/^\d+\.\d+(-\d+)?$/);
           versionObj.editableDisplayName = version.substring(4);
           break;
      }
    },

    allRepos: function () {
      var url = '/stacks?fields=versions/repository_versions/RepositoryVersions';
      var deferred = $q.defer();
      $http.get(Settings.baseUrl + url, {mock: 'version/versions.json'}).then(
        function (resp) {
          var data = resp.data;
          var repos = [];
          angular.forEach(data.items, function(stack) {
            angular.forEach(stack.versions, function (version) {
              var repoVersions = version.repository_versions;
              if (repoVersions.length > 0) {
                repos = repos.concat(repoVersions);
              }
            });
          });
          repos = repos.map(function (stack) {
            stack.RepositoryVersions.isPatch = stack.RepositoryVersions.type === 'PATCH';
            stack.RepositoryVersions.isMaint = stack.RepositoryVersions.type === 'MAINT';
            return stack.RepositoryVersions;
          });
          // prepare response data with client side pagination
          var response = {};
          response.items = repos;
          response.itemTotal = repos.length;
          deferred.resolve(response);
        }, function (resp) {
          deferred.reject(resp.data);
        }
      );
      return deferred.promise;
    },

    addRepo: function (stack, actualVersion, osList) {
      var url = '/stacks/' + stack.stack_name + '/versions/' + stack.stack_version + '/repository_versions/';
      var payload = {};
      var payloadWrap = { RepositoryVersions : payload };
      payload.repository_version = actualVersion;
      payload.display_name = stack.stack_name + '-' + payload.repository_version;
      payloadWrap.operating_systems = [];
      osList.forEach(function (osItem) {
        if (osItem.selected)
        {
          payloadWrap.operating_systems.push({
            "OperatingSystems" : {
              "os_type" : osItem.OperatingSystems.os_type
            },
            "repositories" : osItem.repositories.map(function (repo) {
              return {
                "Repositories" : {
                  "repo_id": repo.Repositories.repo_id,
                  "repo_name": repo.Repositories.repo_name,
                  "base_url": repo.Repositories.base_url
                }
              };
            })
          });
        }
      });
      return $http.post(Settings.baseUrl + url, payloadWrap);
    },

    getRepo: function (repoVersion, stack_name, stack_version) {
      if (stack_version) {
        // get repo by stack version(2.3) and id (112)
        var url = Settings.baseUrl + '/stacks/' + stack_name + '/versions?' +
          'fields=repository_versions/operating_systems/repositories/*' +
          ',repository_versions/operating_systems/OperatingSystems/*' +
          ',repository_versions/RepositoryVersions/*' +
          '&repository_versions/RepositoryVersions/id=' + repoVersion +
          '&Versions/stack_version=' + stack_version;
      } else {
        // get repo by repoVersion (2.3.6.0-2345)
        var url = Settings.baseUrl + '/stacks/' + stack_name + '/versions?' +
          'fields=repository_versions/operating_systems/repositories/*' +
          ',repository_versions/operating_systems/OperatingSystems/*' +
          ',repository_versions/RepositoryVersions/*' +
          '&repository_versions/RepositoryVersions/repository_version=' + repoVersion;
      }
      var deferred = $q.defer();
      $http.get(url, {mock: 'version/version.json'}).then(
        function (resp) {
          var data = resp.data.items[0];
          var response = {
            id : data.repository_versions[0].RepositoryVersions.id,
            stackVersion : data.Versions.stack_version,
            stackName: data.Versions.stack_name,
            type: data.repository_versions[0].RepositoryVersions.release? data.repository_versions[0].RepositoryVersions.release.type: null,
            stackNameVersion: data.Versions.stack_name + '-' + data.Versions.stack_version, /// HDP-2.3
            actualVersion: data.repository_versions[0].RepositoryVersions.repository_version, /// 2.3.4.0-3846
            version: data.repository_versions[0].RepositoryVersions.release ? data.repository_versions[0].RepositoryVersions.release.version: null, /// 2.3.4.0
            releaseNotes: data.repository_versions[0].RepositoryVersions.release ? data.repository_versions[0].RepositoryVersions.release.release_notes: null,
            displayName: data.repository_versions[0].RepositoryVersions.display_name, //HDP-2.3.4.0
            repoVersionFullName : data.Versions.stack_name + '-' + data.repository_versions[0].RepositoryVersions.repository_version,
            ambari_managed_repositories: data.repository_versions[0].operating_systems[0].OperatingSystems.ambari_managed_repositories !== false,
            osList: data.repository_versions[0].operating_systems,
            updateObj: data.repository_versions[0]
          };
          var services = [];
          angular.forEach(data.repository_versions[0].RepositoryVersions.stack_services, function (service) {
            var servicesToExclude = ['GANGLIA', 'KERBEROS', 'MAPREDUCE2'];
            if (servicesToExclude.indexOf(service.name) === -1) {
              services.push({
                name: service.name,
                version: service.versions[0],
                displayName: service.display_name
              });
            }
          });
          response.services = services.sort(function(a, b){return a.name.localeCompare(b.name)});
          deferred.resolve(response);
        }, function (resp) {
          deferred.reject(resp.data);
        }
      );
      return deferred.promise;
    },

    postVersionDefinitionFile: function (isXMLdata, data, isDryRun) {
      var deferred = $q.defer(),
        url = Settings.baseUrl + '/version_definitions?skip_url_check=true' + (isDryRun ? '&dry_run=true' : ''),
        configs = isXMLdata? { headers: {'Content-Type': 'text/xml'}} : null;

      $http.post(url, data, configs).then(
        function (response) {
          if (response.data.resources.length && response.data.resources[0].VersionDefinition) {
            deferred.resolve(response.data);
          }
        }, function (resp) {
          deferred.reject(resp.data);
        }
      );
      return deferred.promise;
    },

    updateRepo: function (stackName, stackVersion, id, payload) {
      var url = Settings.baseUrl + '/stacks/' + stackName + '/versions/' + stackVersion + '/repository_versions/' + id;
      return $http.put(url, payload);
    },

    deleteRepo: function (stackName, stackVersion, id) {
      var url = Settings.baseUrl + '/stacks/' + stackName + '/versions/' + stackVersion + '/repository_versions/' + id;
      return $http.delete(url);
    },

    getSupportedOSList: function (stackName, stackVersion) {
      var url = Settings.baseUrl + '/stacks/' + stackName + '/versions/' + stackVersion + '?fields=operating_systems/repositories/Repositories';
      return $http.get(url, {mock: 'stack/operatingSystems.json'}).then(function (resp) {
        return resp.data;
      });
    },

    validateBaseUrls: function(skip, osList, stack) {
      var deferred = $q.defer(),
        url = Settings.baseUrl + '/stacks/' + stack.stack_name + '/versions/' + stack.stack_version,
        totalCalls = 0,
        invalidUrls = [];

      if (skip) {
        deferred.resolve(invalidUrls);
      } else {
        osList.forEach(function (os) {
          if (os.selected && !os.disabled) {
            os.repositories.forEach(function (repo) {
              totalCalls++;
              $http.post(url + '/operating_systems/' + os.OperatingSystems.os_type + '/repositories/' + repo.Repositories.repo_id + '?validate_only=true',
                {
                  "Repositories": {
                    "base_url": repo.Repositories.base_url,
                    "repo_name": repo.Repositories.repo_name
                  }
                },
                {
                  repo: repo
                }
              ).then(function () {
                totalCalls--;
                if (totalCalls === 0) deferred.resolve(invalidUrls);
              }, function (response) {
                invalidUrls.push(response.config.repo);
                totalCalls--;
                if (totalCalls === 0) deferred.resolve(invalidUrls);
              });
            });
          }
        });
      }
      return deferred.promise;
    },

    highlightInvalidUrls :function(invalidrepos) {
      invalidrepos.forEach(function(repo) {
        repo.hasError = true;
      });
    },

    /**
     * Callback for sorting models with `id`-property equal to something like version number: 'HDP-1.2.3', '4.2.52' etc
     *
     * @param {{id: string}} obj1
     * @param {{id: string}} obj2
     * @returns {number}
     */
    sortByIdAsVersion: function (obj1, obj2) {
      var id1 = _parseId(obj1.id);
      var id2 = _parseId(obj2.id);
      var lId1 = id1.length;
      var lId2 = id2.length;
      var limit = lId1 > lId2 ? lId2 : lId1;
      for (var i = 0; i < limit; i++) {
        if (id1[i] > id2[i]) {
          return 1;
        }
        if (id1[i] < id2[i]) {
          return -1;
        }
      }
      if (lId1 === lId2) {
        return 0
      }
      return lId1 > lId2 ? 1 : -1;
    },

    filterAvailableServices: function (response) {
      var stackVersion = response.updateObj.RepositoryVersions || response.updateObj.VersionDefinition;
      var nonStandardVersion = stackVersion.type !== 'STANDARD';
      var availableServices = (nonStandardVersion ? stackVersion.services : response.services).map(function (s) {
        return s.name;
      });
      return response.services.filter(function (service) {
        var skipServices = ['MAPREDUCE2', 'GANGLIA', 'KERBEROS'];
        return skipServices.indexOf(service.name) === -1 && availableServices.indexOf(service.name) !== -1;
      }) || [];
    }

  };
}]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
  .factory('AddRepositoryModal', ['$modal', '$q', function($modal, $q) {
    var modalObject = {};

    modalObject.repoExists = function(existingRepos, repoId) {
      for(var i = existingRepos.length - 1; i >= 0; --i) {
        if (existingRepos[i].Repositories.repo_id === repoId) {
          return true;
        }
      }
      return false;
    };

    modalObject.getRepositoriesForOS = function (osList, selectedOS) {
      // Get existing list of repositories for selectedOS
      for (var i = osList.length - 1; i >= 0; --i) {
        if (osList[i].OperatingSystems.os_type === selectedOS) {
          osList[i].repositories = osList[i].repositories || [];
          return osList[i].repositories;
        }
      }
      return null;
    };

    modalObject.show = function (osList, stackName, stackVersion, repositoryVersionId) {
      var deferred = $q.defer();
      var modalInstance = $modal.open({
        templateUrl: 'views/modals/AddRepositoryModal.html',
        controller: ['$scope', '$modalInstance', function ($scope, $modalInstance) {
          $scope.osTypes = osList.map(function (os) {
            return os.OperatingSystems.os_type;
          });
          $scope.repo = {
            selectedOS: $scope.osTypes[0]
          };

          $scope.add = function (newRepo) {
            var repositoriesForOS = modalObject.getRepositoriesForOS(osList, newRepo.selectedOS);

            // If repo with the same id exists for the selectedOS, show an alert and do not take any action
            $scope.showAlert = modalObject.repoExists(repositoriesForOS, newRepo.id);
            if ($scope.showAlert) {
              return;
            }

            // If no duplicate repository is found on the selectedOS, add the new repository
            repositoriesForOS.push({
              Repositories: {
                repo_id: newRepo.id,
                repo_name: newRepo.name,
                os_type: newRepo.selectedOS,
                base_url: newRepo.baseUrl,
                stack_name: stackName,
                stack_version: stackVersion,
                repository_version_id: repositoryVersionId
              }
            });

            $modalInstance.close();
            deferred.resolve();
          };

          $scope.cancel = function () {
            $modalInstance.dismiss();
            deferred.reject();
          };
        }]
      });
      modalInstance.result.then(function () {
        // Gets triggered on close
      }, function () {
        // Gets triggered on dismiss
        deferred.reject();
      });
      return deferred.promise;
    };

    return modalObject;
  }]);
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
  .factory('AddVersionModal', ['$modal', '$q', function($modal, $q) {
    var modalObject = {};

    modalObject.repoExists = function(existingRepos, repoId) {
      for(var i = existingRepos.length - 1; i >= 0; --i) {
        if (existingRepos[i].Repositories.repo_id === repoId) {
          return true;
        }
      }
      return false;
    };

    modalObject.getRepositoriesForOS = function (osList, selectedOS) {
      // Get existing list of repositories for selectedOS
      for (var i = osList.length - 1; i >= 0; --i) {
        if (osList[i].OperatingSystems.os_type === selectedOS) {
          osList[i].repositories = osList[i].repositories || [];
          return osList[i].repositories;
        }
      }
      return null;
    };

    modalObject.show = function (parentScope) {
      var deferred = $q.defer();
      var modalInstance = $modal.open({
        templateUrl: 'views/modals/AddVersionModal.html',
        controller: ['$scope', '$modalInstance', '$translate', 'Stack', 'Alert', function ($scope, $modalInstance, $translate, Stack, Alert) {
          var $t = $translate.instant;
          $scope.selectedLocalOption = {
            index: 1
          };
          $scope.option1 = {
            index: 1,
            displayName: $t('versions.uploadFile'),
            file: ''
          };
          $scope.option2 = {
            index: 2,
            displayName: $t('versions.enterURL'),
            url: "",
            placeholder: $t('versions.URLPlaceholder')
          };
          $scope.readInfoButtonDisabled = function () {
            return $scope.option1.index == $scope.selectedLocalOption.index ? !$scope.option1.file : !$scope.option2.url;
          };
          $scope.onFileSelect = function(e){
            $scope.option1.file = '';
            if (e.files && e.files.length == 1) {
              var file = e.files[0];
              var reader = new FileReader();
              reader.onload = (function () {
                return function (e) {
                  $scope.option1.file = e.target.result;
                  $scope.$apply();
                };
              })(file);
              reader.readAsText(file);
            }
            $scope.$apply();
          };
          /**
           * Load selected file to current page content
           */
          $scope.readVersionInfo = function(){
            var data = {};
            var isXMLdata = false;
            if ($scope.option2.index == $scope.selectedLocalOption.index) {
              var url = $scope.option2.url;
              data = {
                "VersionDefinition": {
                  "version_url": url
                }
              };
            } else if ($scope.option1.index == $scope.selectedLocalOption.index) {
              isXMLdata = true;
              // load from file browser
              data = $scope.option1.file;
            }
            parentScope.isXMLdata = isXMLdata;
            parentScope.data = data;

            return Stack.postVersionDefinitionFile(isXMLdata, data, true).then(function (versionInfo) {
              var repo = versionInfo.resources[0];
              var response = {
                id : repo.VersionDefinition.id,
                stackVersion : repo.VersionDefinition.stack_version,
                stackName: repo.VersionDefinition.stack_name,
                type: repo.VersionDefinition.release? repo.VersionDefinition.release.type: null,
                stackNameVersion: repo.VersionDefinition.stack_name + '-' + repo.VersionDefinition.stack_version, /// HDP-2.3
                stackNameRepositoryVersion: repo.VersionDefinition.stack_name + '-' + repo.VersionDefinition.repository_version,
                actualVersion: repo.VersionDefinition.repository_version, /// 2.3.4.0-3846
                version: repo.VersionDefinition.release ? repo.VersionDefinition.release.version: null, /// 2.3.4.0
                releaseNotes: repo.VersionDefinition.release ? repo.VersionDefinition.release.release_notes: null,
                displayName: repo.VersionDefinition.stack_name + '-' + repo.VersionDefinition.repository_version, //HDP-2.3.4.0
                editableDisplayName: repo.VersionDefinition.repository_version.substring(4),
                isNonXMLdata: !isXMLdata,
                repoVersionFullName : repo.VersionDefinition.stack_name + '-' + repo.VersionDefinition.release ? repo.VersionDefinition.release.version: repo.VersionDefinition.repository_version,
                ambari_managed_repositories: repo.operating_systems[0].OperatingSystems.ambari_managed_repositories !== false,
                osList: repo.operating_systems,
                updateObj: repo
              };
              var services = [];
              angular.forEach(repo.VersionDefinition.stack_services, function (service) {
                var servicesToExclude = ['GANGLIA', 'KERBEROS', 'MAPREDUCE2'];
                if (servicesToExclude.indexOf(service.name) === -1) {
                  services.push({
                    name: service.name,
                    version: service.versions[0],
                    displayName: service.display_name
                  });
                }
              });
              response.services = services.sort(function(a, b){return a.name.localeCompare(b.name)});
              response.osList.forEach(function (os) {
                os.repositories.forEach(function(repo) {
                  repo.Repositories.initial_base_url = repo.Repositories.base_url;
                });
              });

              angular.forEach(parentScope.stackIds, function(stack){
                if (stack.stackNameVersion == response.stackNameVersion) {
                  parentScope.setStackIdActive(stack);
                }
              });
              parentScope.allVersions.push(response);
              angular.forEach(parentScope.allVersions, function(version) {
                var isPublicVersionsExist = false;
                // If public VDF exists for a stack then default base stack version should be hidden
                if (version.stackDefault) {
                  isPublicVersionsExist = parentScope.allVersions.find(function(_version){
                    return (version.stackNameVersion === _version.stackNameVersion && !_version.stackDefault);
                  });
                }
                version.visible = (version.stackNameVersion === response.stackNameVersion) && !isPublicVersionsExist;
              });
              parentScope.activeStackVersion = response;
              parentScope.selectedPublicRepoVersion = response;
              parentScope.setVersionSelected(response);
              $modalInstance.close();
              deferred.resolve();
            }).catch(function (data) {
              Alert.error($t('versions.alerts.readVersionInfoError'), data.message);
            });
          };
          $scope.cancel = function () {
            $modalInstance.dismiss();
            deferred.reject();
          };
        }]
      });
      modalInstance.result.then(function () {
        // Gets triggered on close
      }, function () {
        // Gets triggered on dismiss
        deferred.reject();
      });
      return deferred.promise;
    };

    return modalObject;
  }]);

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.factory('RoleDetailsModal', ['$modal', 'Cluster', function($modal, Cluster) {
  return {
    show: function(roles) {
      roles = roles.map(function(role) {
        var r = role.PermissionInfo;
        r.authorizations = role.authorizations.map(function(authorization) {
          return authorization.AuthorizationInfo;
        });
        return r;
      });
      var modalInstance = $modal.open({
        templateUrl: 'views/modals/RoleDetailsModal.html',
        size: 'lg',
        controller: function($scope, $modalInstance) {
          var authorizationsOrder;
          $scope.title = '';
          $scope.orderedRoles = ['AMBARI.ADMINISTRATOR'].concat(Cluster.orderedRoles).reverse();
          $scope.orderedLevels = Cluster.orderedLevels;
          $scope.authHash = {};
          $scope.getLevelName = function (key) {
            return key.charAt(0) + key.slice(1).toLowerCase();
          };
          angular.forEach(roles, function (r) {
            angular.forEach(r.authorizations, function (auth) {
              var match = auth.authorization_id.match(/(\w+)\./),
                  levelKey = match && match[1],
                  isLevelDisplayed = $scope.orderedLevels.indexOf(levelKey) !== -1;
              if (isLevelDisplayed) {
                if (!$scope.authHash[levelKey]) {
                  $scope.authHash[levelKey] = {};
                }
                if (!$scope.authHash[levelKey][auth.authorization_id]) {
                  $scope.authHash[levelKey][auth.authorization_id] = {
                    name: auth.authorization_name,
                    roles: {}
                  };
                }
                $scope.authHash[levelKey][auth.authorization_id].roles[r.permission_name] = true;
              }
            });
          });

          // sort authorizations for each level by number of roles permissions
          for (var level in $scope.authHash) {
            if ($scope.authHash.hasOwnProperty(level)) {
              authorizationsOrder = Object.keys($scope.authHash[level]).sort(function (a, b) {
                return Object.keys($scope.authHash[level][b].roles).length - Object.keys($scope.authHash[level][a].roles).length;
              });
              $scope.authHash[level].order = authorizationsOrder;
            }
          }

          $scope.roles = roles.sort(function (a, b) {
            return $scope.orderedRoles.indexOf(a.permission_name) - $scope.orderedRoles.indexOf(b.permission_name);
          });
          $scope.ok = function() {
            $modalInstance.dismiss();
          };
        }
      });
      return modalInstance.result;
    }
  }
}]);
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.factory('Pagination', function() {

  function showItemsOnPage(items, tableInfo) {
    var startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
    var endIndex = this.currentPage * this.itemsPerPage;
    var showedCount = 0;
    var filteredCount = 0;

    angular.forEach(items, function (item) {
      item.isShowed = false;
      if (item.isFiltered) {
        filteredCount++;
        if (filteredCount >= startIndex && filteredCount <= endIndex) {
          item.isShowed = true;
          showedCount++;
        }
      }
    });
    tableInfo.showed = showedCount;
  }

  return {
    create: function(options) {
      options = options || {};
      return {
        itemsPerPage: options.itemsPerPage || 10,
        currentPage: options.currentPage || 1,
        maxVisiblePages: options.maxVisiblePages || 10,
        pageChanged: function(items, tableInfo) {
          showItemsOnPage.call(this, items, tableInfo);
        },
        resetPagination: function(items, tableInfo) {
          this.currentPage = 1;
          showItemsOnPage.call(this, items, tableInfo);
        }
      }
    }
  };
});

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.factory('Filters', function() {

  function initFilterOptions(filters, items) {
    filters.filter(function(filter) {
      return !filter.isStatic;
    }).forEach(function(filter) {
      var preOptions = [];
      if (filter.isMultiple) {
        items.forEach(function(item) {
          if (typeof filter.customValueConverter === 'function') {
            preOptions = preOptions.concat(filter.customValueConverter(item));
          } else {
            preOptions = preOptions.concat(item[filter.key]);
          }
        });
      } else {
        preOptions = items.map(function(item) {
          if (typeof filter.customValueConverter === 'function') {
            return filter.customValueConverter(item);
          }
          return item[filter.key];
        });
      }
      filter.options = $.unique(preOptions).filter(function(item) {
        return item !== undefined && item !== null;
      }).map(function(item) {
        return {
          key: item,
          label: item
        }
      });
    });
  }

  function filterItems(appliedFilters, items, filterDefinitions) {
    var filteredCount = 0;
    angular.forEach(items, function(item) {
      item.isFiltered = !(appliedFilters && appliedFilters.length > 0 && appliedFilters.some(function(filter) {
        var customValueFilter = filterDefinitions.filter(function(filterDefinition) {
          return filterDefinition.key === filter.key && typeof filterDefinition.customValueConverter === 'function';
        })[0];
        if (customValueFilter) {
          return filter.values.every(function(value) {
            var itemValue = customValueFilter.customValueConverter(item);
            var preparedValue = Array.isArray(itemValue) ? itemValue.join().toLowerCase() : itemValue.toLowerCase();
            return String(preparedValue).indexOf(value.toLowerCase()) === -1;
          });
        }
        return filter.values.every(function(value) {
          var itemValue = item[filter.key];
          var preparedValue = Array.isArray(itemValue) ? itemValue.join().toLowerCase() : itemValue.toLowerCase();
          return String(preparedValue).indexOf(value.toLowerCase()) === -1;

        });
      }));

      filteredCount += ~~item.isFiltered;
    });
    return filteredCount;
  }

  return {
    initFilterOptions: initFilterOptions,
    filterItems: filterItems
  };
});
