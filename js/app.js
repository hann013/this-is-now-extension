var app = angular.module("ThisIsNowApp", ['ngRoute', 'ui.bootstrap']);

app.controller("MainController", function($scope, UserService) {
    $scope.user = UserService.user;
    $scope.showToDoList = true;
    $scope.showWaterIntake = true;

    if (UserService.user.background.Type == "web") {
        console.log("here");
        $scope.backgroundImage = UserService.user.background.WebUrl;
        console.log($scope.backgroundImage);
    }
    else {
        $scope.backgroundImage = UserService.user.background.LocalUrl;
    }
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

    // Show "this is now" message when cursor hovers over date/time
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
        $scope.sips = settings.CurrentSips;
        $scope.sipsGoal = Math.round(settings.Goal / 15);
        var notifs = setInterval(createNotification, settings.Frequency);

        // Generate notifications based on selected frequency
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
                progress: Math.round(($scope.sips / $scope.sipsGoal) * 100),
                buttons: [{
                    title: "I took a sip!"
                }]
            };
            chrome.notifications.create(id, opt);
        }

        // Alert if water goal is reached for the day
        chrome.notifications.onButtonClicked.addListener(function() {
            $scope.sips += 1;
            if ($scope.sips / $scope.sipsGoal >= 1) {
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
    else {
        $("#water").hide();
    }
});

// Handles to-do list related activities
app.controller("ToDoController", function($scope, $compile, UserService) {
    $scope.user.tasks = UserService.user.tasks;
    $scope.taskCount = $scope.user.tasks.length;

    // Update task count
    $scope.$watch(function(scope) { return scope.user.tasks.length; },
        function(updatedValue) { $scope.taskCount = updatedValue; } 
    );

    // Create a new task
    $scope.addTask = function() {
        var newTask = $(document.createElement("to-do-item"));
        newTask.insertBefore("#addNew");
        $compile(newTask)($scope);
    }

    // Save tasks to local storage
    $scope.save = function() {
        UserService.save();
    }

    // Drag to sort tasks - IN-PROGRESS
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
            var textArea = $(element).find(".taskDescription");
            textArea.keydown(function(e) {
                // Hit "enter" to save task
                if (e.keyCode == 13) {
                    e.preventDefault();
                    
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
                }
            })
            // Edit saved task by double-clicking
            .on('dblclick', function() {
                scope.user.tasks[element.attr("data-index")].saved = false;
                textArea.removeClass("done");
                checkbox.prop("checked", false);
            });

            // Track whether or not task is checked off
            var checkbox = $(element).find(".checkTask");
            checkbox.on('click', function() {
                var checked = checkbox.is(":checked");
                var i = element.attr("data-index");

                if (checked) {
                    textArea.addClass("done");
                    scope.user.tasks[i].done = true;
                }
                else {
                    textArea.removeClass("done");
                    scope.user.tasks[i].done = false;
                }
                scope.save();
            });

            // Delete tasks
            var deleteButton = $(element).find(".deleteTask");
            deleteButton.on('click', function() {
                scope.user.tasks.splice(element.attr("data-index"), 1);
                scope.save();
                element.remove();
            });
            // Only show button to delete task upon hover
            element.on("mouseover", function() {
                deleteButton.css("opacity", "1");
            })
            .on("mouseout", function() {
                deleteButton.css("opacity", "0");
            });
        }
    }
});

// Display the current weather and 3-day forecast
app.controller("WeatherController", function($scope, WeatherForecast, UserService) {
    $scope.showForecast = false;
    $scope.weather = {};

    navigator.geolocation.getCurrentPosition(setPosition);

    // Utilize saved location or auto-determined location to get weather forecast
    function setPosition(position) {
        var userLocation;
        if (UserService.user.location) {
            userLocation = UserService.user.location;
        }
        else {
            userLocation = position.coords.latitude + "," + position.coords.longitude;
        }
        WeatherForecast.getWeatherForecast(userLocation)
        .then(function(data){
            $scope.userLocation = data[0];
            $scope.weather.today = data[1].forecastday[0];
            $scope.weather.forecast = data[1];
        });
    }
    
    // Display "show forecast" tool-tip prompt on hover
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
                    if (data.RESULTS.length > 6) {
                        d.resolve(data.RESULTS.slice(0,6));
                    }
                    else {
                        d.resolve(data.RESULTS);
                    }
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
    // Default user settings 
    var defaults = {
        location: "",
        background: { Type: "web", LocalUrl: "", WebUrl: "" },
        waterNotifications: { On: true, Frequency: 900000, Goal: 1500, CurrentSips: 0 },
        tasks: [],
        tasksNotifications: { On: true, Frequency: 900000, ShowAll: true }
    };

    // Save and restore user settings to/from Chrome local storage
    var service = {
        user: {},
        save: function() {
            localStorage.thisIsNow = angular.toJson(service.user); 

            var localImageInput = document.getElementById("file").files;

            if (localImageInput.length) {
                console.log(localImageInput);
                var reader = new FileReader();
                reader.readAsDataURL(localImageInput[0]);
            }
        },
        restore: function() {
            service.user = angular.fromJson(localStorage.thisIsNow) || defaults;
        },
    }

    service.restore();
    return service;
});

// Settings page
app.controller("SettingsController", function($scope, UserService, WeatherForecast, $http) {
    $scope.user = UserService.user;

    $scope.getCityResults = WeatherForecast.getCityDetails;

    $scope.notificationFrequencies = [
        { value: 900000, name: "15 minutes" },
        { value: 1800000, name: "30 minutes" },
        { value: 2700000, name: "45 minutes" },
        { value: 3600000, name: "1 hour" },
        { value: 7200000, name: "2 hours" }
    ];

    $scope.showTasks = [
        { value: true, name: "All tasks" },
        { value: false, name: "Start from top of list" }
    ];

    $scope.save = function() {
        // Local file selection - IN PROGRESS
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