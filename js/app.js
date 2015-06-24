var app = angular.module("ThisIsNowApp", ['ngRoute']);

app.controller("MainController", function($scope, UserService) {
    $scope.user = UserService.user;
    $scope.showToDoList = true;
})

// Display and update the time and date
app.controller("ClockController", function($scope) {
    $scope.showThisIsNow = false;

    // Function that updates clock time
    function updateClock() {
        $scope.clock = new Date();
    }

    // Initialize time on load
    updateClock();

    // Update clock time every minute and bind change in time
    var timer = setInterval(function() {
        $scope.$apply(updateClock);
    }, 1000);

    function toggleThisIsNow() {
        $scope.showThisIsNow = !$scope.showThisIsNow;
    }

    $(".time").on("mouseover", toggleThisIsNow).on("mouseleave", toggleThisIsNow);
});

// Displays reminder notifications for water intake 
app.controller("WaterController", function($scope, UserService) {
    var settings = UserService.user.waterNotifications;
    if (settings.On)
    {
        var sips = 0;
        var sipsGoal = Math.round(settings.Goal / 15);
        var notifs = setInterval(createNotification, settings.Frequency);

        function createNotification() {
            chrome.notifications.getAll(function(notifs){
                for (id in notifs) {
                    chrome.notifications.clear(id);
                }
            });

            var id = "waterNotification" + new Date().getTime();
            var opt = {
                type: "progress",
                title: "Remember to drink water",
                message: "Remember to take a sip!",
                iconUrl: "/img/glass-of-water.jpg",
                progress: Math.round((sips / sipsGoal) * 100),
                buttons: [{
                    title: "I took a sip!"
                }]
            };
            chrome.notifications.create(id, opt);
        }

        chrome.notifications.onButtonClicked.addListener(function() {
            sips += 1;
            if (sips / sipsGoal >= 1) {
                clearInterval(notifs);
                chrome.notifications.create({
                    type: "basic",
                    title: "Goal reached",
                    message: "You reached your daily water intake goal!",
                    iconUrl: "/img/glass-of-water.jpg"
                });
            }
        });
    }
});

// Handles to-do list related activities
app.controller("ToDoController", function($scope, $compile, UserService) {
    $scope.user.tasks = UserService.user.tasks;
    $scope.taskCount = $scope.user.tasks.length;

    $scope.$watch(function(scope) { return scope.user.tasks.length; },
        function(updatedValue) { $scope.taskCount = updatedValue; } 
    );

    $scope.addTask = function() {
        var newTask = $(document.createElement("to-do-item"));
        newTask.insertBefore("#addNew");
        $compile(newTask)($scope);
    }

    $scope.save = function() {
        UserService.save();
    }

    $("#toDo").sortable({ 
        cursor: "move",
        items: ">> .task", 
    });
});

// Item in the to-do list
app.directive("toDoItem", function() {
    return {
        restrict: "E",
        scope: true,
        templateUrl: "/templates/to-do-item.html",
        link: function(scope, element, attrs) {
            element.on("mouseover", function() {
                deleteButton.css("opacity", "1");
            })
            .on("mouseleave", function() {
                deleteButton.css("opacity", "0");
            });

            var textArea = $(element).find(".taskDescription");
            textArea.keydown(function(e) {
                if (e.keyCode == 13) {
                    e.preventDefault();
                    saveButton.click();
                }
            })
            .on('dblclick', function() {
                scope.user.tasks[element.attr("data-index")].saved = false;
                textArea.removeClass("done");
                checkbox.prop("checked", false);
            });

            var checkbox = $(element).find(".checkTask");
            checkbox.on('click', function() {
                var checked = checkbox.is(":checked");
                var i = element.attr("data-index");

                if (checked) {
                    textArea.addClass("done");
                    scope.user.tasks[i].done = true;
                    scope.save();
                }
                else {
                    textArea.removeClass("done");
                    scope.user.tasks[i].done = false;
                    scope.save();
                }
            });

            var saveButton = $(element).find(".saveTask");
            saveButton.on('click', function() {
                var task = { description: textArea.val(), done: false, saved: true };

                if (element.attr("id") == "newTask" )
                {
                    scope.user.tasks.push(task);
                    textArea.val("");
                    scope.save();
                }
                else if (element.attr("data-index"))
                {
                    scope.user.tasks.splice(element.attr("data-index"), 1, task);
                    scope.save();
                }
            });

            var deleteButton = $(element).find(".deleteTask");
            deleteButton.on('click', function() {
                scope.user.tasks.splice(element.attr("data-index"), 1);
                scope.save();
                element.remove();
            });
        }
    }
});

// Display the current weather and 3-day forecast
app.controller("WeatherController", function($scope, WeatherForecast) {
    $scope.showForecast = false;
    $scope.weather = {};

    navigator.geolocation.getCurrentPosition(setPosition, errorHandler);

    function setPosition(position) {
        var latitude = position.coords.latitude;
        var longitude = position.coords.longitude;
        var userLocation = latitude + "," + longitude;

        WeatherForecast.getWeatherForecast(userLocation)
        .then(function(data){
            $scope.userLocation = data[0];
            $scope.weather.today = data[1].forecastday[0];
            $scope.weather.forecast = data[1];
        });
    }

    function errorHandler(err) {
        console.log(err);
    }
    
    $scope.showWeatherHover = function() {
        var today = document.getElementById("today");
        var weatherHover = document.getElementById("showWeather");

        weatherHover.style.opacity = 0.75; 
        
        if ($scope.showForecast) { 
            weatherHover.innerHTML = "Hide forecast"; 
        }
        else { 
            weatherHover.innerHTML = "Show forecast"; 
        }

        today.addEventListener("mouseleave", function() {
            weatherHover.style.opacity = 0;
        });
    };
});

// Display weather information
app.provider("WeatherForecast", function() {
    var apiKey = "";

    this.setApiKey = function(key)
    {
        if (key) { this.apiKey = key; } 
    }

    this.createRequestUrl = function(type, location) {
        return "http://api.wunderground.com/api/" + this.apiKey + "/" + type + "/q/" + location + ".json";
    }

    this.$get = function($q, $http) {
        var self = this;

        return {
            getWeatherForecast: function(location) {
                var d = $q.defer();

                $http({
                    method: "GET",
                    url: self.createRequestUrl("geolookup/forecast", location),
                    cache: true
                })
                .success(function(data) {
                    d.resolve([data.location, data.forecast.simpleforecast]);
                })
                .error(function(err) {
                    d.reject(err);
                });

                return d.promise;
            },

            getCityDetails: function(query) {
                var d = $q.defer();

                $http({
                    method: "GET",
                    url: "http://autocomplete.wunderground.com/aq?query=" + query
                })
                .success(function(data){
                    d.resolve(data.RESULTS);
                })
                .error(function(err){
                    d.reject(err);
                });

                return d.promise;
            }
        }
    }
});

// Set Wunderground API key - withheld from GitHub
app.config(function(WeatherForecastProvider) {
    WeatherForecastProvider.setApiKey("");
});

// Service to save user settings
app.factory('UserService', function(){ 
    var defaults = {
        location: "Determine automatically",
        waterNotifications: { On: true, Frequency: 1800000, Goal: 100 },
        tasks: []
    };

    var service = {
        user: {},
        save: function() {
            localStorage.thisIsNow = angular.toJson(service.user);
        },
        restore: function() {
            service.user = angular.fromJson(localStorage.thisIsNow) || defaults;
        },
    }

    service.restore();
    return service;
});

// Settings page
app.controller("SettingsController", function($scope, UserService, WeatherForecast) {
    $scope.user = UserService.user;

    $scope.getCityResults = WeatherForecast.getCityDetails;

    $scope.save = function() {
        if ($("#file")[0].files[0] && $("#file")[0].files[0].type.indexOf("image") == -1) {
            $("#file").val("");
            alert("Please select a valid image file.");
        }
        else {
            //chrome.fileSystem.getDisplayPath($("#file")[0].files[0], function(path) { console.log(path); });
            UserService.save();
        } 
    };
});

app.directive("autoFill", function($timeout) {
    return {
        restrict: "EA",
        scope: {
            autoFill: "&",
            ngModel: "="
        },
        compile: function(inputElement, inputAttrs) {
            // compilation function - necessary for creating new element
            var autoFillElement = angular.element('<div class="typeahead">' +
                                          '<input type="text" autocomplete="off" />' +
                                          '<ul id="autolist" ng-show="reslist">' +
                                            '<li ng-repeat="res in reslist" ' +
                                              '>{{res.name}}</li>' +
                                          '</ul>' +
                                          '</div>');
            var input = autoFillElement.find("input");
            input.attr("type", inputAttrs.type);
            input.attr("ng-model", inputAttrs.ngModel);
            inputElement.replaceWith(autoFillElement);            

            return function(scope, ele, attrs, ctrl) {
                // link function
                  var minKeyCount = attrs.minKeyCount || 3,
                      timer,
                      input = ele.find('input');

                  input.bind('keyup', function(e) {
                    val = ele.val();
                    if (val.length < minKeyCount) {
                      if (timer) $timeout.cancel(timer);
                      scope.reslist = null;
                      return;
                    } else {
                      if (timer) $timeout.cancel(timer);
                      timer = $timeout(function() {
                        scope.autoFill()(val)
                        .then(function(data) {
                          if (data && data.length > 0) {
                            scope.reslist = data;
                            scope.ngModel = data[0].zmw;
                          }
                        });
                      }, 300);
                    }
                  });
                  // Hide the reslist on blur
                  input.bind('blur', function(e) {
                    scope.reslist = null;
                    scope.$digest();
                  });
            }
        }
    }
});

// Routing to multiple screens
app.config(function($routeProvider) {
    $routeProvider
    .when("/", {
        templateUrl: "/templates/home.html",
        controller: "MainController"
    })
    .when("/settings", {
        templateUrl: "/templates/settings.html",
        controller: "SettingsController"
    })
    .otherwise({
        redirectTo: "/"
    });
});