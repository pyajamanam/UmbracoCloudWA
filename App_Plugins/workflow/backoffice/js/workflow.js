/*! plumber - v0.2.0-build81 - 2017-12-18
 * Copyright (c) 2017 Nathan Woulfe;
 * Licensed MIT
 */

(function () {
    'use strict';

    function addController($scope, workflowGroupsResource, navigationService, notificationsService, treeService) {

        $scope.add = function (name) {
          workflowGroupsResource.add(name)
                .then(function (resp) {
                    if (resp.status === 200) {
                        treeService.loadNodeChildren({ node: $scope.$parent.currentNode.parent(), section: 'users' })
                            .then(function () {
                                window.location = '/umbraco/#/workflow/tree/edit/' + resp.id;
                            });
                        notificationsService.success('SUCCESS', resp.msg);
                    } else {
                        notificationsService.error('ERROR', resp.msg);
                    }
                }, function (err) {   
                    notificationsService.error('ERROR', err);
                });
        };

        $scope.cancelAdd = function () {
            navigationService.hideNavigation();
        };
    }

    angular.module('umbraco').controller('Workflow.Groups.Add.Controller', addController);
}());


(function () {
    'use strict';

    function dashboardController(workflowGroupsResource) {

        var vm = this;

      workflowGroupsResource.get()
            .then(function (resp) {
                vm.loading = false;
                vm.items = resp;
            });

        function getEmail(users) {
            return users.map(function (v) {
                return v.user.email;
            }).join(';');
        }

        angular.extend(vm, {
            name: 'Approval groups',
            loading: true,
            items: [],

            getEmail: getEmail
        });
    }

    angular.module('umbraco').controller('Workflow.Groups.Dashboard.Controller', dashboardController);

}());
(function () {
    'use strict';

    function deleteController($scope, workflowGroupsResource, navigationService, treeService, notificationsService) {

        $scope.delete = function (id) {
          workflowGroupsResource.delete(id)
                .then(function (resp) {
                    treeService.loadNodeChildren({ node: $scope.$parent.currentNode.parent(), section: 'users' })
                        .then(function () {
                            window.location = '/umbraco/#/workflow/tree/view/groups';
                        });
                    navigationService.hideNavigation();
                    notificationsService.success('SUCCESS', resp);
                });
        };

        $scope.cancelDelete = function () {
            navigationService.hideNavigation();
        };
    }

    angular.module('umbraco').controller('Workflow.Groups.Delete.Controller', deleteController);
}());


(function () {
  'use strict';

  function editController($scope, $routeParams, $location, $timeout, workflowGroupsResource, workflowResource, dialogService, entityResource, notificationsService, contentResource, navigationService, eventsService) {

    var vm = this;

    // only fetch group if id is valid - otherwise it's a create action
    function init() {
      if ($routeParams.id !== '-1') {
        workflowGroupsResource.get($routeParams.id)
            .then(function (resp) {
              vm.group = resp;
              vm.name = $routeParams.id !== '-1' ? 'Edit ' : 'Create ' + resp.name;

              if (vm.group.permissions) {
                getContentTypes();
              }
            });
      } else {
        vm.group = {
          groupId: -1,
          name: '',
          description: '',
          alias: '',
          groupEmail: '',
          users: [],
          usersSummary: ''
        };
      }
    }


    function getContentTypes() {

      vm.nodePermissions = vm.group.permissions.filter(function (v) {
        return v.nodeId;
      });

      vm.docPermissions = vm.group.permissions.filter(function (v) {
        return v.contentTypeId;
      });

      if (vm.nodePermissions.length) {
        contentResource.getByIds(vm.nodePermissions.map(function (v) { return v.nodeId; }))
            .then(function (resp) {
              resp.forEach(function (v) {
                vm.nodePermissions.forEach(function (p) {
                  if (p.nodeId === v.id) {
                    p.icon = v.icon;
                    p.path = v.path;
                    p.name = v.name + ' - stage ' + (p.permission + 1);
                  }
                });
              });
            });
      }

      if (vm.docPermissions.length) {
        workflowResource.getContentTypes()
            .then(function (resp) {
              resp.forEach(function (v) {
                vm.docPermissions.forEach(function (p) {
                  if (p.contentTypeId === v.id) {
                    p.icon = v.icon;
                    p.path = v.path;
                    p.name = v.name + ' - stage ' + (p.permission + 1);
                  }
                });
              });
            });
      }
    }

    // history tab
    function getHistory() {
      workflowResource.getAllTasksForGroup($routeParams.id, vm.pagination.perPage, vm.pagination.pageNumber)
          .then(function (resp) {
            vm.tasks = resp.items;
            vm.pagination.pageNumber = resp.page;
            vm.pagination.totalPages = resp.total / resp.count;
          });
    }

    function goToPage(i) {
      vm.pagination.pageNumber = i;
      getHistory();
    }

    function editDocTypePermission() {
      $location.path('/workflow/tree/view/settings');
    }

    // todo -> Would be sweet to open the config dialog from here, rather than just navigating to the node...
    function editContentPermission(id, path) {
      navigationService.changeSection('content');
      $location.path('/content/content/edit/' + id);
    }

    //
    function remove(id) {
      var index;
      vm.group.users.forEach(function (u, i) {
        if (u.userId === id) {
          index = i;
        }
      });
      vm.group.users.splice(index, 1);
    }

    function openUserPicker() {
      vm.userPicker = {
        view: '../app_plugins/workflow/backoffice/dialogs/workflow.userpicker.overlay.html',
        selection: vm.group.users,
        show: true,
        submit: function (model) {
          vm.userPicker.show = false;
          vm.userPicker = null;

          vm.group.users = [];
          model.selection.forEach(function (u) {
            vm.group.users.push({ userId: u.userId || u.id, groupId: vm.group.groupId, name: u.name });
          });
        },
        close: function (oldModel) {
          vm.userPicker.show = false;
          vm.userPicker = null;
        }
      };
    }

    //
    function save() {
      workflowGroupsResource.save(vm.group)
          .then(function (resp) {
            if (resp.status === 200) {
              notificationsService.success('SUCCESS', resp.msg);
              $scope.approvalGroupForm.$setPristine();
            } else {
              notificationsService.error('ERROR', resp.msg);
            }
          }, function (err) {
            notificationsService.error('ERROR', err);
          });
    }

    angular.extend(vm, {
      save: save,
      remove: remove,
      editContentPermission: editContentPermission,
      editDocTypePermission: editDocTypePermission,
      openUserPicker: openUserPicker,
      perPage: function () {
        return [2, 5, 10, 20, 50];
      },

      tabs: [{
        id: 0,
        label: "Group detail",
        alias: "tab0",
        active: true
      },
      {
        id: 1,
        label: "Activity history",
        alias: "tab1",
        active: false
      }],
      pagination: {
        pageNumber: 1,
        totalPages: 0,
        perPage: 10,
        goToPage: goToPage
      }
    });

    init();
    getHistory();
  }

  angular.module('umbraco').controller('Workflow.Groups.Edit.Controller', editController);
}());


(function () {
  'use strict';

  function treeController($scope, $routeParams, eventsService, treeService) {
    var vm = this;

    vm.templatePartialUrl = '../App_Plugins/workflow/backoffice/tree/' + $routeParams.tree + '.html';

    $scope.$on('loadStateChange', function (e, args) {
      vm.loading = args.state;
    });

    // set the current node state in the menu 
    eventsService.on('appState.treeState.changed', function (event, args) {
      if (args.key === 'selectedNode' && args.value.routePath.indexOf('workflow') === 0) {
        event.currentScope.nav.syncTree({
          tree: args.value.routePath.split('/')[1],
          path: treeService.getPath(args.value),
          forceReload: false
        });
        event.currentScope.nav.changeSection('workflow');
      }
    });
  }

  angular.module('umbraco').controller('Workflow.Tree.Controller', treeController);

}());
(function () {
    'use strict';

    function actionController($scope) {
        $scope.limit = 250;
        $scope.disabled = $scope.isFinalApproval === true ? false : true;       
    }

    angular.module('umbraco').controller('Workflow.Action.Controller', actionController);
}());


(function () {
    'use strict';

    function dashboardController(workflowResource) {

        var vm = this,
            msPerDay = 1000 * 60 * 60 * 24,
            now = new Date();

        function lineChart(items) {

            var series = [],
                seriesNames = [],
                s, o,
                isTask = vm.type === 'Task',
                d = new Date();

            d.setDate(d.getDate() - vm.range);
            var then = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

            var spline = {
                type: 'spline',
                name: 'Pending ' + vm.type.toLowerCase() + 's',
                data: defaultData(),
                colorIndex: 2,
                pointStart: then,
                pointInterval: msPerDay
            };

            items.forEach(function (v) {
                var statusName = isTask ? v.statusName : v.status;

                if (statusName !== 'Pending Approval') {
                    if (seriesNames.indexOf(statusName) === -1) {
                        o = {
                            name: statusName,
                            type: 'column',
                            data: defaultData(),
                            pointStart: then,
                            pointInterval: msPerDay
                        };
                        series.push(o);
                        seriesNames.push(statusName);
                    }

                    s = series.filter(function (s) {
                        return s.name === statusName;
                    })[0];

                    s.data[vm.range + dateDiffInDays(now, new Date(isTask ? v.createdDate : v.requestedOn))] += 1;

                    if (statusName === 'Approved') {
                        vm.totalApproved += 1;
                        s.colorIndex = 0;
                    }
                    else if (statusName === 'Rejected') {
                        vm.totalRejected += 1;
                        s.colorIndex = 2;
                    }
                    else {
                        vm.totalCancelled += 1;
                        s.colorIndex = 1;
                    }

                } else {
                    spline.data[vm.range + dateDiffInDays(now, new Date(isTask ? v.createdDate : v.requestedOn))] += 1;
                    vm.totalPending += 1;
                }
            });

            spline.data.forEach(function (d, i) {
                if (i > 0) {
                    spline.data[i] += spline.data[i - 1];
                }
            });
            series.push(spline);

            vm.series = series.sort(function (a, b) { return a.name > b.name; });

            vm.title = 'Workflow ' + vm.type.toLowerCase() + ' activity';
            vm.loaded = true;
        }

        // a and b are javascript Date objects
        function dateDiffInDays(a, b) {
            // Discard the time and time-zone information.
            var utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
            var utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

            return Math.floor((utc2 - utc1) / msPerDay - 1);
        }

        function defaultData() {
            var arr = [];
            for (var i = 0; i <= vm.range; i += 1) {
                arr.push(0);
            }
            return arr;
        }

        function getForRange() {
            if (vm.range > 0) {
                vm.loaded = false;
                vm.totalApproved = vm.totalCancelled = vm.totalPending = vm.totalRejected = 0;

                if (vm.type === 'Task') {
                    workflowResource.getAllTasksForRange(vm.range)
                        .then(function (resp) {
                            lineChart(resp.items);
                        });
                } else {
                    workflowResource.getAllInstancesForRange(vm.range)
                        .then(function (resp) {
                            lineChart(resp.items);
                        });
                }
            }
        }

        // kick it off with a four-week span
        angular.extend(vm, {
            range: 28,
            type: 'Task',
            loaded: false,
            totalApproved: 0,
            totalCancelled: 0,
            totalPending: 0,
            totalRejected: 0,

            getForRange: getForRange
        });

        getForRange();
    }

    angular.module('umbraco').controller('Workflow.AdminDashboard.Controller', dashboardController);
}());
(function () {
    'use strict';

    // create controller 
    function cancelController($scope) {
        $scope.model.comment = '';
        $scope.limit = 250;
        $scope.intro = 'This operation will cancel the workflow on this document and notify the workflow participants. Are you sure?';
        $scope.disabled = $scope.model.isFinalApproval === true ? false : true;
    }

    // register controller 
    angular.module('umbraco').controller('Workflow.Cancel.Controller', cancelController);
}());

(function () {
    'use strict';

    // create controller 
    function configController($scope, workflowGroupsResource, workflowResource, notificationsService, contentResource, navigationService) {
        var vm = this,
            nodeId = $scope.dialogOptions.currentNode ? $scope.dialogOptions.currentNode.id : undefined,
            nodeIdInt = nodeId ? parseInt(nodeId, 10) : undefined;

        function init() {
            workflowGroupsResource.get()
				.then(function (resp) {
				    vm.groups = resp;

				    contentResource.getById(nodeId)
                        .then(function (resp) {
                            vm.contentTypeName = resp.contentTypeName;
                            checkNodePermissions();
                            checkAncestorPermissions(resp.path.split(','));
                        });
				});
        }

        if (!nodeId) {
            navigationService.hideDialog();
            notificationsService.error('ERROR', 'No active content node');
        }
        else {
            init();
        }

        function checkNodePermissions() {
            angular.forEach(vm.groups, function (v) {
                angular.forEach(v.permissions, function (p) {
                    if (p.nodeId === nodeIdInt) {
                        vm.approvalPath[p.permission] = v;
                    }

                    if (p.contentTypeName === vm.contentTypeName) {
                        vm.contentTypeApprovalPath[p.permission] = v;
                    }
                });
            });
        }

        function checkAncestorPermissions(path) {
            // first is -1, last is the current node
            path.shift();
            path.pop();

            angular.forEach(path, function (id) {
                angular.forEach(vm.groups, function (v) {
                    angular.forEach(v.permissions, function (p) {
                        if (p.nodeId === parseInt(id, 10)) {
                            vm.inherited[p.permission] = {
                                name: v.name,
                                groupId: p.groupId,
                                nodeName: p.nodeName,
                                permission: p.permission
                            };
                        }
                    });
                });
            });
        }

        function save() {
            var response = {};
            response[nodeIdInt] = [];

            angular.forEach(vm.approvalPath, function (v, i) {
                response[nodeIdInt].push(v.permissions.filter(function (p) {
                    return +p.nodeId === nodeIdInt && p.permission === i;
                })[0]);
            });

            workflowResource.saveConfig(response)
                .then(function () {
                    notificationsService.success('SUCCESS', 'Workflow configuration updated');
                    init();
                }, function (err) {
                    notificationsService.error('ERROR', err);
                });               
            
        }

        function add() {
            vm.selectedApprovalGroup.permissions.push({
                nodeId: nodeId,
                permission: vm.approvalPath.length,
                groupId: vm.selectedApprovalGroup.groupId
            });

            vm.approvalPath.push(vm.selectedApprovalGroup);
        }

        function remove($event, index) {
            $event.stopPropagation();
            $event.target.classList.add('disabled');
            vm.approvalPath.splice(index, 1);

            vm.approvalPath.forEach(function (v, i) {
                v.permissions.forEach(function (p) {
                    if (p.nodeId === nodeIdInt) {
                        p.permission = i;
                    }
                });
            });
        }

        angular.extend(vm, {
            inherited: [],
            approvalPath: [],
            contentTypeApprovalPath: [],

            save: save,
            add: add,
            remove: remove
        });
    }

    // register controller 
    angular.module('umbraco').controller('Workflow.Config.Controller', configController);
}());


(function () {
    'use strict';

    function dashboardController() {
        var vm = this;

        angular.extend(vm, {
            tabs: [{
                id: 101,
                label: "Settings",
                alias: "tab101",
                active: true
            }, {
                id: 102,
                label: "History",
                alias: "tab102",
                active: false
            }, {
                id: 103,
                label: "Approval groups",
                alias: "tab103",
                active: false
            }, {
                id: 104,
                label: "Context menu",
                alias: "tab104",
                active: false
            }, {
                id: 105,
                label: "User dashboard",
                alias: "tab105",
                active: false
            }, {
                id: 106,
                label: "Editor drawer",
                alias: "tab106",
                active: false
            }]
        });
    }

    angular.module('umbraco').controller('Workflow.DocsDashboard.Controller', dashboardController);

}());
(function () {
  'use strict';

  // create controller 
  // since this controller is loaded in response to an injector match, we can use it to check for active workflow groups 
  // and display a message if none are configured, while also displaying the default button set
  function controller($scope, $rootScope, userService, workflowResource, workflowActionsService, contentEditingHelper, contentResource, editorState, $routeParams, notificationsService) {
    var vm = this,
        user;

    var defaultButtons = contentEditingHelper.configureContentEditorButtons({
      create: $routeParams.create,
      content: $scope.content,
      methods: {
        saveAndPublish: $scope.saveAndPublish,
        sendToPublish: $scope.sendToPublish,
        save: $scope.save,
        unPublish: angular.noop
      }
    });

    var saveAndPublish = defaultButtons.defaultButton && defaultButtons.defaultButton.labelKey === 'buttons_saveAndPublish';

    function getNodeTasks() {
      workflowResource.getNodePendingTasks(editorState.current.id)
          .then(function (resp) {
            if (resp.noFlow || resp.settings) {
              var msg = resp.noFlow
                ? 'No workflow groups have been configured - refer to the documentation tab in the Workflow section, then set at minimum an approval flow on the homepage node or document type.'
                : 'Workflow settings are configured incorrectly - refer to the documentation tab in the Workflow section.';
              notificationsService.warning('WORKFLOW INSTALLED BUT NOT CONFIGURED', msg);
            } else if (resp.items && resp.items.length) {
              vm.active = true;
              checkUserAccess(resp.items[0]);
            } else {
              vm.active = false;
              setButtons();
            }
          }, function () {

          });
    }

    // must be a better way of doing this - need to watch the editor state to dynamically change buttons
    //$scope.$watch('$parent.$parent.$parent.contentForm.$dirty', function (newVal) {
    //  $scope.dirty = newVal === true;
    //  getNodeTasks();
    //});

    $rootScope.$on('workflowActioned', function () {
      getNodeTasks();
    });

    var buttons = {
      approveButton: {
        labelKey: 'workflow_approveButtonLong',
        handler: function (item) {
          vm.workflowOverlay = workflowActionsService.action(item, true);
        }
      },
      cancelButton: {
        labelKey: 'workflow_cancelButtonLong',
        cssClass: 'danger',
        handler: function (item) {
          vm.workflowOverlay = workflowActionsService.cancel(item);
        }
      },
      rejectButton: {
        labelKey: 'workflow_rejectButton',
        cssClass: 'warning',
        handler: function (item) {
          vm.workflowOverlay = workflowActionsService.action(item, false);
        }
      },
      saveButton: {
        labelKey: 'workflow_saveButton',
        cssClass: 'success',
        handler: function () {
          contentEditingHelper.contentEditorPerformSave({
            statusMessage: 'Saving...',
            saveMethod: contentResource.save,
            scope: $scope,
            content: editorState.current
          });
          $scope.$parent.$parent.$parent.contentForm.$setPristine();
        }
      },
      publishButton: {
        labelKey: 'workflow_publishButton',
        cssClass: 'success',
        handler: function () {
          vm.workflowOverlay = workflowActionsService.initiate(editorState.current.name, editorState.current.id, true);
        }
      },
      unpublishButton: {
        labelKey: 'workflow_unpublishButton',
        cssClass: 'warning',
        handler: function () {
          vm.workflowOverlay = workflowActionsService.initiate(editorState.current.name, editorState.current.id, false);
        }
      }
    };

    // any user with access to the workflow section will be able to action workflows ie cancel outside their group membership
    function checkUserAccess(task) {
      vm.task = task;
      vm.adminUser = user.allowedSections.indexOf('workflow') !== -1;
      var currentTaskUsers = task.permissions[task.currentStep].userGroup.usersSummary;

      if (currentTaskUsers.indexOf('|' + user.id + '|') !== -1) {
        vm.canAction = true;
      }
      if (vm.active) {
        vm.buttonGroup = {
          defaultButton: vm.canAction ? buttons.approveButton : vm.adminUser ? buttons.cancelButton : null,
          subButtons: vm.canAction ? [buttons.rejectButton, buttons.cancelButton] : []
      };
      }
    }

    function setButtons() {
      // default button will be null when the current user has browse-only permission
      if (defaultButtons.defaultButton !== null) {
        var subButtons = saveAndPublish ? [buttons.unpublishButton, defaultButtons.defaultButton, buttons.saveButton] : [buttons.unpublishButton, buttons.saveButton];

        vm.buttonGroup = {
          defaultButton: $scope.dirty ? buttons.saveButton : buttons.publishButton,
          subButtons: $scope.dirty ? (saveAndPublish ? [defaultButtons.defaultButton] : []) : subButtons
        };
      }
    }

    userService.getCurrentUser()
        .then(function (userResp) {
          user = userResp;
          getNodeTasks();
        });

    angular.extend(vm, {
      active: false
    });
  }

  // register controller 
  angular.module('umbraco').controller('Workflow.DrawerButtons.Controller', controller);
}());


(function () {
    'use strict';

    function historyController($scope, workflowResource) {

      var vm = this,
            width = $scope.dialogOptions ? $scope.dialogOptions.currentAction.metaData.width : undefined,
            node = $scope.dialogOptions ? $scope.dialogOptions.currentNode : undefined;

        if (width) {
            angular.element('#dialog').css('width', width);
        }

        function perPage() {
            return [2, 5, 10, 20, 50];
        }

        function selectNode() {
            vm.overlay = {
                view: 'contentpicker',
                show: true,
                submit: function (model) {
                    vm.overlay.show = false;
                    vm.overlay = null;
                    if (model.selection) {
                        auditNode(model.selection[0]);
                    } else {
                        $scope.items = [];
                    }
                },
                close: function () {
                    vm.overlay.show = false;
                    vm.overlay = null;
                }
            };
        }

        function getAllInstances() {
            vm.loading = true;

            // when switching, set state, reset paging and clear node data
            if (!vm.instanceView) {
                vm.instanceView = true;
                vm.pagination.pageNumber = 1;
                vm.node = undefined;
            }

            workflowResource.getAllInstances(vm.pagination.perPage, vm.pagination.pageNumber)
                .then(function (resp) {
                    setPaging(resp);
                });
        }

        function auditNode(data) {
            vm.loading = true;

            // when switching from instance to node, reset paging, toggle state and store node
            if (vm.instanceView) {
                vm.pagination.pageNumber = 1;
                vm.instanceView = false;
            }

            vm.node = data || vm.node;

            workflowResource.getNodeTasks(vm.node.id, vm.pagination.perPage, vm.pagination.pageNumber)
                .then(function (resp) {
                    setPaging(resp);
                });
        }

        function goToPage(i) {
            vm.pagination.pageNumber = i;
            if (vm.node !== undefined) {
                auditNode();
            } else {
                getAllInstances();
            }
        }

        function setPaging(resp) {
            vm.items = resp.items;
            vm.pagination.pageNumber = resp.page;
            vm.pagination.totalPages = resp.total / resp.count;
            vm.loading = false;
        }

        angular.extend(vm, {
            auditNode: auditNode,
            getAllInstances: getAllInstances,
            selectNode: selectNode,
            perPage: perPage,

            name: 'Workflow history',
            pagination: {
                pageNumber: 1,
                totalPages: 0,
                perPage: 10,
                goToPage: goToPage
            }
        });

        // go get the data
        (function () {
            if (node) {
                auditNode(node);
            } else {
                getAllInstances();
            }
        }());
    }

    angular.module('umbraco').controller('Workflow.History.Controller', historyController);

}());
(function () {
  'use strict';

  function settingsController($q, workflowResource, notificationsService, workflowGroupsResource) {
    var vm = this,
        promises = [workflowResource.getSettings(), workflowResource.getContentTypes(), workflowGroupsResource.get()];

    $q.all(promises)
        .then(function (resp) {

          vm.settings = resp[0];
          vm.docTypes = resp[1];
          vm.groups = resp[2];

          vm.flowTypes = [
              { i: 0, v: 'Other groups must approve' },
              { i: 1, v: 'All groups must approve' },
              { i: 2, v: 'All groups must approve, ignore author' }
          ];

          vm.flowType = vm.flowTypes[vm.settings.flowType];

          if (vm.settings.defaultApprover) {
            vm.defaultApprover = vm.groups.filter(function (v) {
              return parseInt(v.groupId, 10) === parseInt(vm.settings.defaultApprover, 10);
            })[0];
          }

          vm.groups.forEach(function (g) {
            g.permissions.forEach(function (p) {
              if (p.contentTypeId > 0) {
                vm.docTypes.forEach(function (dt) {
                  if (dt.id === p.contentTypeId) {
                    if (!dt.approvalPath) {
                      dt.approvalPath = [];
                    }

                    dt.approvalPath[p.permission] = g;
                  }
                });
              }
            });
          });
        });


    function save() {
      var permissions = {};
      vm.settings.defaultApprover = vm.defaultApprover.groupId;
      vm.settings.flowType = vm.flowType.i;

      angular.forEach(vm.docTypes, function (dt, i) {
        if (dt.approvalPath && dt.approvalPath.length) {
          permissions[i] = [];
          angular.forEach(dt.approvalPath,
            function(path, ii) {
              permissions[i].push({
                contentTypeId: dt.id,
                permission: ii,
                groupId: path.groupId
              });
            });
        } 
      });

      var p = [workflowResource.saveDocTypeConfig(permissions), workflowResource.saveSettings(vm.settings)];
      $q.all(p)
          .then(function () {
            notificationsService.success('SUCCESS!', 'Settings updated');
          }, function (err) {
            notificationsService.error('OH SNAP!', err);
          });
    }

    function add(dt) {
      if (dt.approvalPath) {
        dt.approvalPath.push(dt.selectedApprovalGroup);
      } else {
        dt.approvalPath = [dt.selectedApprovalGroup];
      }
    }

    function remove(dt, index) {
      dt.approvalPath.splice(index, 1);
    }

    angular.extend(vm, {
      save: save,
      add: add,
      remove: remove,
      name: 'Workflow settings',

      email: '',
      defaultApprover: '',
      settings: {
        email: '',
        defaultApprover: ''
      }
    });
  }

  angular.module('umbraco').controller('Workflow.Settings.Controller', settingsController);

}());
(function () {
    'use strict';

    function submitController($scope) {
        $scope.$watch('model.comment', function (newVal) {
            $scope.model.hideSubmitButton = !newVal || newVal.length === 0;
        });
    }

    angular.module('umbraco').controller('Workflow.Submit.Controller', submitController);
}());
(function () {
    'use strict';

    function dashboardController($scope, $rootScope, $routeParams, workflowResource, authResource, notificationsService) {

        var vm = this;

        function init() {
            getPending();
            getSubmissions();
            getAdmin();
        }

        // dash needs notification of when to refresh, as the action is in a deeper scope
        $rootScope.$on('refreshWorkflowDash', function () {
            authResource.getCurrentUser()
                .then(function (user) {
                    vm.currentUser = user;
                    vm.adminUser = user.allowedSections.indexOf('workflow') !== -1;
                    init();
                });
        });

        function getPending() {
            // api call for tasks assigned to the current user
            workflowResource.getApprovalsForUser(vm.currentUser.id, vm.taskPagination.perPage, vm.taskPagination.pageNumber)
                .then(function (resp) {
                    vm.tasks = resp.items;
                    vm.taskPagination.pageNumber = resp.page;
                    vm.taskPagination.totalPages = resp.total / resp.count;
                    vm.loaded[0] = true;
                }, function (err) {
                    notify(err);
                });
        }

        function getSubmissions() {
            // api call for tasks created by the current user
            workflowResource.getSubmissionsForUser(vm.currentUser.id, vm.submissionPagination.perPage, vm.submissionPagination.pageNumber)
                .then(function (resp) {
                    vm.submissions = resp.items;
                    vm.submissionPagination.pageNumber = resp.page;
                    vm.submissionPagination.totalPages = resp.total / resp.count;
                    vm.loaded[1] = true;
                }, function (err) {
                    notify(err);
                });
        }

        function getAdmin() {
            // if the current user is in an admin group, display all active tasks
            if (vm.adminUser) {
                workflowResource.getPendingTasks(vm.adminPagination.perPage, vm.adminPagination.pageNumber)
                    .then(function (resp) {
                        vm.activeTasks = resp.items;
                        vm.adminPagination.pageNumber = resp.page;
                        vm.adminPagination.totalPages = resp.total / resp.count;
                        vm.loaded[2] = true;
                    }, function (err) {
                        notify(err);
                    });
            }
        }

        function goToPage(i) {
            vm.pagination.pageNumber = i;
        }

        // display notification after actioning workflow task
        function notify(d) {
            if (d.status === 200) {
                notificationsService.success("SUCCESS!", d.message);
                init();
            }
            else {
                notificationsService.error("OH SNAP!", d.message);
            }            
        }

        // expose some bits
        angular.extend(vm, {
            tasks: [],
            submissions: [],
            activeTasks: [],
            loaded: [false, false, false],
            goToPage: goToPage,

            taskPagination: {
                pageNumber: 1,
                totalPages: 0,
                perPage: 5,
                goToPage: function (i) {
                    vm.taskPagination.pageNumber = i;
                    getPending();
                }
            },

            submissionPagination: {
                pageNumber: 1,
                totalPages: 0,
                perPage: 5,
                goToPage: function (i) {
                    vm.submissionPagination.pageNumber = i;
                    getSubmissions();
                }
            },

            adminPagination: {
                pageNumber: 1,
                totalPages: 0,
                perPage: 10,
                goToPage: function (i) {
                    vm.adminPagination.pageNumber = i;
                    getAdmin();
                }
            }
        });

        // kick it all off
        authResource.getCurrentUser()
            .then(function (user) {
                vm.currentUser = user;
                vm.adminUser = user.allowedSections.indexOf('workflow') !== -1;
                init();
            });
    }

    // register controller 
    angular.module('umbraco').controller('Workflow.UserDashboard.Controller', dashboardController);
}());
// this is almost identical to the Umbraco default, only the id property on the user object is changed to userId
(function () {
    "use strict";

    function userPickerController($scope, usersResource, localizationService) {

        var vm = this;

        vm.users = [];
        vm.loading = false;
        vm.usersOptions = {};

        vm.selectUser = selectUser;
        vm.searchUsers = searchUsers;
        vm.changePageNumber = changePageNumber;

        //////////

        function onInit() {

            vm.loading = true;

            // set default title
            if (!$scope.model.title) {
                $scope.model.title = localizationService.localize("defaultdialogs_selectUsers");
            }

            // make sure we can push to something
            if (!$scope.model.selection) {
                $scope.model.selection = [];
            }

            // get users
            getUsers();

        }

        function preSelect(selection, users) {
            angular.forEach(selection, function (selected) {
                angular.forEach(users, function (user) {
                    if (selected.userId === user.id) {
                        user.selected = true;
                    }
                });
            });
        }

        function selectUser(user) {

            if (!user.selected) {

                user.selected = true;
                $scope.model.selection.push(user);

            } else {

                angular.forEach($scope.model.selection, function (selectedUser, index) {
                    if (selectedUser.userId === user.id) {
                        user.selected = false;
                        $scope.model.selection.splice(index, 1);
                    }
                });

            }

        }

        var search = _.debounce(function () {
            $scope.$apply(function () {
                getUsers();
            });
        }, 500);

        function searchUsers() {
            search();
        }

        function getUsers() {

            vm.loading = true;

            // Get users
            usersResource.getPagedResults(vm.usersOptions).then(function (users) {

                vm.users = users.items;

                vm.usersOptions.pageNumber = users.pageNumber;
                vm.usersOptions.pageSize = users.pageSize;
                vm.usersOptions.totalItems = users.totalItems;
                vm.usersOptions.totalPages = users.totalPages;

                preSelect($scope.model.selection, vm.users);

                vm.loading = false;

            });
        }

        function changePageNumber(pageNumber) {
            vm.usersOptions.pageNumber = pageNumber;
            getUsers();
        }

        onInit();

    }

    angular.module("umbraco").controller("Workflow.UserPicker.Controller", userPickerController);

})();
(function () {
    'use strict';

    function ButtonGroupDirective() {

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '../app_plugins/workflow/backoffice/partials/workflowButtonGroup.html',
            scope: {
                defaultButton: "=",
                subButtons: "=",
                state: "=?",
                item: "=",
                direction: "@?",
                float: "@?"
            }
        };

        return directive;
    }

    angular.module('umbraco.directives').directive('workflowButtonGroup', ButtonGroupDirective);

}());

(function () {
    'use strict';    

    function CommentsDirective() {

        var directive = {
            restrict: 'AEC',
            scope: {
                intro: '=',
                labelText: '=',
                comment: '=',
                limit: '=',
                isFinalApproval: '=',
                disabled: '='
            },
            template: '<p ng-bind="intro"></p><label for="comments">{{labelText}} <span ng-bind="info"></span><textarea name="comments" ng-model="comment" ng-change="limitChars()" no-dirty-check></textarea>',
            link: function (scope) {

                scope.limitChars = function () {

                    var limit = scope.limit;

                    if (scope.comment.length > limit) {
                        scope.info = '(Comment max length exceeded - limit is ' + limit + ' characters.)';
                        scope.comment = scope.comment.substr(0, limit);
                    } else {
                        scope.info = '(' + (limit - scope.comment.length) + ' characters remaining.)';
                    }

                    if (!scope.isFinalApproval) {
                        scope.disabled = scope.comment.length === 0;
                    }
                };
            }
        };

        return directive;
    }

    angular.module('umbraco.directives').directive('wfComments', CommentsDirective);

}());
(function () {
    'use strict';

    function historyDirective() {

        var directive = {
            restrict: 'E',
            scope: {
                items: '=',
                instanceView: '=',
                groupHistoryView: '='
            },
            templateUrl: '../app_plugins/workflow/backoffice/partials/workflowhistorytemplate.html'
        };

        return directive;
    }

    angular.module('umbraco.directives').directive('wfHistory', historyDirective);

}());
(function () {
    'use strict';

    function lineChartDirective() {

        var directive = {
            restrict: 'E',
            template: '<div class="chart-container"><div></div></div>',
            scope: {
                series: '=',
                ready: '='
            },
            link: function (scope, element) {
                var el = element[0].querySelector('.chart-container div');
               
                scope.$watch('ready', function (newVal, oldVal) {
                    if (newVal === true) {
                        var options = {
                            credits: {
                                enabled:false
                            },
                            title: {
                                text: null
                            },
                            tooltip: {
                                shared: true,
                                formatter: function () {
                                    var r = this.points.filter(function (p, i) {
                                        return p.y > 0;
                                    }).length > 0;

                                    if (!r) { return false; }

                                    var s = '<span>' + new Date(this.x).toDateString() + '</span><br />';
                                    this.points.forEach(function (p, i) {
                                        s += '<span class="highcharts-color-' + i + '">\u25CF</span> ' + p.series.name + ': <b>' + p.y + '</b><br/>';
                                    });

                                    return s;
                                }
                            },
                            series: scope.series,
                            xAxis: {
                                type: 'datetime',
                                dateTimeLabelFormats: {
                                    day: '%b %e'
                                }
                            },
                            yAxis: {
                                allowDecimals: false,
                                minTickInterval:1,
                                title: {
                                    text: null
                                }
                            }
                        };

                        Highcharts.chart(el, options);
                    }
                });
            }
        };

        return directive;
    }

    angular.module('umbraco.directives').directive('wfLineChart', lineChartDirective);

}());

(function () {
    'use strict';

    function TableRowDirective() {

        var directive = {
            restrict: 'E',
            scope: {
                item: '=',
                instanceView: '=',
                groupHistoryView: '='
            },
            link: function (scope) {
                scope.templateUrl = '../app_plugins/workflow/backoffice/partials/table/' + (scope.instanceView ? 'historyinstance' : 'historytask') + '.html';
            },
            template: '<ng-include src="templateUrl"></ng-include>'
        };

        return directive;
    }

    angular.module('umbraco.directives').directive('wfTableRow', TableRowDirective);

}());
(function () {
    'use strict';

    function TasksDirective(dialogService, notificationsService, workflowActionsService) {

        var directive = {
            restrict: 'AEC',
            scope: {
                heading: '=',
                items: '=',
                type: '=',
                loaded: '='
            },
            templateUrl: '../app_plugins/workflow/backoffice/partials/workflowTasksTemplate.html',
            controller: function ($scope) {

                // type = 0, 1
                // 0 -> full button set
                // 1 -> cancel, edit
                var buttons = {
                    approveButton: {
                        labelKey: "workflow_approveButton",
                        handler: function (item) {
                            $scope.$parent.vm.workflowOverlay = workflowActionsService.action(item, true, true);
                        }
                    },
                    editButton: {
                        labelKey: "workflow_editButton",
                        href: '/umbraco/#/content/content/edit/'
                    },
                    cancelButton: {
                        labelKey: "workflow_cancelButton",
                        cssClass: 'danger',
                        handler: function (item) {
                            $scope.$parent.vm.workflowOverlay = workflowActionsService.cancel(item, true);
                        }
                    },                
                    rejectButton: {
                        labelKey: "workflow_rejectButton",
                        cssClass: 'warning',
                        handler: function (item) {
                            $scope.$parent.vm.workflowOverlay = workflowActionsService.action(item, false, true);
                        }
                    }
                };

                var subButtons = [
                    [buttons.editButton, buttons.rejectButton, buttons.cancelButton],
                    [buttons.editButton]
                ];

                $scope.buttonGroup = {
                    defaultButton: $scope.type === 0 ? buttons.approveButton : buttons.cancelButton,
                    subButtons: subButtons[$scope.type]
                };
            }
        };

        return directive;
    }

    angular.module('umbraco.directives').directive('wfTasks', TasksDirective);

}());

/* register all interceptors 
 * 
 */
(function () {
    'use strict';

    angular.module('umbraco')
        .config(function ($httpProvider) {
            $httpProvider.interceptors.push('drawerButtonsInterceptor');
        });
})();
(function () {
    // replace the editor buttons if the page is in a workflow and the user has approval rights
    function interceptor($q) {
        return {
            request: function (request) {
                if (request.url.toLowerCase().indexOf('footer-content-right') !== -1) {
                    if (location.href.indexOf('content') !== -1) {
                        request.url = '/App_Plugins/workflow/backoffice/partials/umbEditorFooterContentRight.html';
                    }
                }
                return request || $q.when(request);
            }
        };
    }

    angular.module('umbraco').factory('drawerButtonsInterceptor', ['$q', interceptor]);
})();
(function () {
    'use strict';

    function workflowActionsService($rootScope, workflowResource, notificationsService, editorState, angularHelper) {
        var service = {

            action: function (item, approve, fromDash) {
                var workflowOverlay = {
                    view: '../app_plugins/workflow/backoffice/dialogs/workflow.action.dialog.html',
                    show: true,
                    title: (approve ? 'Approve' : 'Reject') + ' workflow process',
                    subtitle: 'Document: ' + item.nodeName,
                    comment: item.comments,
                    approvalComment: '',
                    requestedBy: item.requestedBy,
                    requestedOn: item.requestedOn,
                    submit: function (model) {
                        if (approve) {
                            workflowResource.approveWorkflowTask(item.taskId, model.comment)
                                .then(function (resp) {
                                    notify(resp, fromDash);
                                });
                        }
                        else {
                            workflowResource.rejectWorkflowTask(item.taskId, model.comment)
                                .then(function (resp) {
                                    notify(resp, fromDash);
                                });
                        }
                        workflowOverlay.close();
                    },
                    close: function () {
                        workflowOverlay.show = false;
                        workflowOverlay = null;
                    }
                };

                return workflowOverlay;
            },

            initiate: function (name, id, publish) {
                var workflowOverlay = {
                    view: '../app_plugins/workflow/backoffice/dialogs/workflow.submit.dialog.html',
                    show: true,
                    title: 'Send for ' + (publish ? 'publish' : 'unpublish') + ' approval',
                    subtitle: 'Document: ' + name,
                    isPublish: publish,
                    nodeId: id,
                    submit: function (model) {
                        workflowResource.initiateWorkflow(id, model.comment, publish)
                            .then(function (resp) {
                                notify(resp);
                            });

                        workflowOverlay.close();
                    },
                    close: function () {
                        workflowOverlay.show = false;
                        workflowOverlay = null;
                    }
                };

                return workflowOverlay;
            },

            cancel: function (item, fromDash) {
                var workflowOverlay = {
                    view: '../app_plugins/workflow/backoffice/dialogs/workflow.cancel.dialog.html',
                    show: true,
                    title: 'Cancel workflow process',
                    subtitle: 'Document: ' + item.nodeName,
                    comment: '',
                    isFinalApproval: item.activeTask === 'Pending Final Approval',
                    submit: function (model) {
                        workflowResource.cancelWorkflowTask(item.taskId, model.comment)
                            .then(function (resp) {
                                notify(resp, fromDash);
                                workflowOverlay.close();
                            });
                    },
                    close: function () {
                        workflowOverlay.show = false;
                        workflowOverlay = null;
                    }
                };

                return workflowOverlay;
            }
        };

        // display notification after actioning workflow task
        function notify(d, fromDash) {
            if (d.status === 200) {
                // todo -> find a v7.7 way to make this work
                //var contentForm = document.querySelector('[name="contentForm"]');
                //if (contentForm) {
                //    var scope = angular.element(contentForm).scope();
                //    scope.contentForm.$setPristine();
                //}
                notificationsService.success('SUCCESS!', d.message);

                if (fromDash) {
                    $rootScope.$emit('refreshWorkflowDash');
                } else {
                    $rootScope.$emit('workflowActioned');
                }
            }
            else {
                notificationsService.error('OH SNAP!', d.message);
            }
        }

        return service;
    }

    angular.module('umbraco.services').factory('workflowActionsService', workflowActionsService);

}());
(function () {
    'use strict';

    function workflowGroupsResource($http, $q, umbRequestHelper) {
        var service = {

            urlBase: '/umbraco/backoffice/api/workflow/groups/',

            request: function (method, url, data) {
                return umbRequestHelper.resourcePromise(
                    method === 'DELETE' ? $http.delete(url) :
                    method === 'POST' ? $http.post(url, data) :
                    method === 'PUT' ? $http.put(url, data) :
                        $http.get(url),
                    'Something broke'
                );
            },

            /**
             * @returns {array} user groups
             * @description Get single group by id, or all groups if no id parameter provided
             */
            get: function (id) {
                return this.request('GET', this.urlBase + (id ? 'get/' + id : 'get'));
            },

            /**
             * @returns the new user group
             * @description Add a new group, where the param is the new group name
             */
            add: function (name) {
                return this.request('POST', this.urlBase + 'add', { data: name } );
            },

            /**
             * @returns {string}
             * @description save updates to an existing group object
             */
            save: function (group) {
                return this.request('PUT', this.urlBase + 'save', group);
            },

            /**
             * @returns {string}
             * @description delete group by id
             */
            'delete': function (id) {
                return this.request('DELETE', this.urlBase + 'delete/' + id );
            }
        };

        return service;
    }

    angular.module('umbraco.services').factory('workflowGroupsResource', workflowGroupsResource);

}());
(function () {
    'use strict';

    // create service
    function WorkflowResource($http, $q, umbRequestHelper) {
        var urlBase = '/umbraco/backoffice/api/workflow/';

        var service = {

            settingsUrl: urlBase + 'settings/',
            tasksUrl: urlBase + 'tasks/',
            instancesUrl: urlBase + 'instances/',
            actionsUrl: urlBase + 'actions/',

            request: function (method, url, data) {
                return umbRequestHelper.resourcePromise(
                    method === 'GET' ?
                        $http.get(url) :
                        $http.post(url, data),
                    'Something broke'
                );
            },

            getStatus: function (id) {
                return this.request('GET', this.tasksUrl + 'status/' + id);
            },

            getContentTypes: function() {
                return this.request('GET', this.settingsUrl + 'getcontenttypes');
            },

            /* tasks and approval endpoints */
            getApprovalsForUser: function (userId, count, page) {
                return this.request('GET', this.tasksUrl + 'flows/' + userId + '/0/' + count + '/' + page);
            },
            getSubmissionsForUser: function (userId, count, page) {
                return this.request('GET', this.tasksUrl + 'flows/' + userId + '/1/' + count + '/' + page);
            },
            getPendingTasks: function (count, page) {
                return this.request('GET', this.tasksUrl + 'pending/' + count + '/' + page);
            },
            getAllTasksForRange: function (days) {
                return this.request('GET', this.tasksUrl + 'range/' + days);
            },
            getAllInstances: function (count, page) {
                return this.request('GET', this.instancesUrl + count + '/' + page);
            },
            getAllInstancesForRange: function (days) {
                return this.request('GET', this.instancesUrl + 'range/' + days);
            },
            getAllTasksForGroup: function (groupId, count, page) {
                return this.request('GET', this.tasksUrl + 'group/' + groupId + '/' + count + '/' + page);
            },
            getNodeTasks: function(id, count, page) {
                return this.request('GET', this.tasksUrl + 'node/' + id  + '/' + count + '/' + page);
            },
            getNodePendingTasks: function(id) {
                return this.request('GET', this.tasksUrl + 'node/pending/' + id);
            },

            /* workflow actions */
            initiateWorkflow: function (nodeId, comment, publish) {
                return this.request('POST', this.actionsUrl + 'initiate', { nodeId: nodeId, comment: comment, publish: publish });
            },
            approveWorkflowTask: function (taskId, comment) {
                return this.request('POST', this.actionsUrl + 'approve', { taskId: taskId, comment: comment });
            },
            rejectWorkflowTask: function (taskId, comment) {
                return this.request('POST', this.actionsUrl + 'reject', { taskId: taskId, comment: comment });
            },
            cancelWorkflowTask: function (taskId, comment) {
                return this.request('POST', this.actionsUrl + 'cancel', { taskId: taskId, comment: comment });
            },

            /* get/set workflow settings*/
            getSettings: function () {
                return this.request('GET', this.settingsUrl + 'get');
            },
            saveSettings: function (settings) {
                return this.request('POST', this.settingsUrl + 'save', settings);
            },

            /*** SAVE PERMISSIONS ***/
            saveConfig: function (p) {
                return this.request('POST', urlBase + 'config/saveconfig', p);              
            },

            saveDocTypeConfig: function (p) {
              return this.request('POST', urlBase + 'config/savedoctypeconfig', p);
            },

            /**
             *  Helper for generating node path for setting active state in tree
             * @param {} node 
             * @param {} path 
             * @returns {} 
             */
            buildPath: function(node, path) {
              path.push(node.id);

              if (node.id === '-1') {
                return path.reverse();
              }

              var parent = node.parent();

              if (parent === undefined) {
                return path;
              }

              return service.buildPath(parent, path);
            }

        };

        return service;
    }

    // register service
    angular.module('umbraco.services').factory('workflowResource', WorkflowResource);

}());
(function() {
  'use strict';

  var app = angular.module('umbraco');

  app.config(function ($routeProvider) {
    $routeProvider.when('/workflow/:tree',
      {
        template: '<div ng-include="\'/app_plugins/workflow/backoffice/tree/view.html\'"></div>'
      });
  });
}());