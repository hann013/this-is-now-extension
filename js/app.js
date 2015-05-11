var app = angular.module("ThisIsNowApp", ['ngRoute']);

// Display and update the time and date
app.controller("ClockController", function($scope) {
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
});

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

    function alertHello() {
        alert("hello!");
    }
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
            }
        }
    }
});

app.controller("SettingsController", function($scope) {

});

// Set Wunderground API key - withheld from GitHub
app.config(function(WeatherForecastProvider) {
    WeatherForecastProvider.setApiKey("");
});

// Routing to multiple screens
app.config(function($routeProvider) {
    $routeProvider
    .when("/", {
        templateUrl: "/templates/home.html",
    })
    .when("/settings", {
        templateUrl: "/templates/settings.html",
        controller: "SettingsController"
    })
    .otherwise({
        redirectTo: "/"
    });
});