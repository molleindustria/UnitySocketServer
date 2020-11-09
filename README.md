# Unity and socket.io (server)

This is an implementation of the js/node rock paper scissor example with a Unity client.
There is a WebGL build in the *client* sub folder but the project should work both on browser and as a standalone executable.

The client's source is shared in a separate repository as package.

Controls: WASD to move, K and L to change weapon.

## Unity and multiplayer

Unity's networking system is under a major rehaul right now, its old peer to peer system UNET is deprecated and the new solution, Connected Games, is not available yet.

However there are various socket.io libraries for Unity. This project requires a [$10 library from the Asset Store](https://assetstore.unity.com/packages/tools/network/socketio-for-native-and-webgl-builds-76508). From our perspective, it is very similar to [this free and open source one](https://assetstore.unity.com/packages/tools/network/socket-io-for-unity-21721) except it works on WebGL (browser build), it's more recent and actively maintained as for 2020 - though it may throw some warnings.

The server side is almost exacly the same as the previous example. Since all the game logic is on the server, you can theoretically run the same game on clients built with completely different technologies.

Some issues with using socket.io and Unity:

* Compare to js+node it's more annoying to test
* Sending and receiving objects is not as straighforward as in js
* It's complicated to set up for WebGL


## Setup
In js and node.js projects, the source code *is* the code that gets deployed. Unity projects don't work this way. You will not run or upload the client source project (the folder you open in the Unity editor), rather you will create a *build* for the client's operating system: Windows, Mac or WebGL (browser).

My recommendation is to use VS Code for the server side (node.js) and Visual Studio for the Unity side to compartimentalize these two environments. 

All clients should run the same code so you need to rebuild, close and reopen the executables every time there is a significant change.

### Testing locally

* Clone and download this repository. 
* Open it in VS Code 
* Run npm install to install the dependencies
* run ```node server.js``` or ```nodemon server.js```
* Open different tabs and point them to localhost
You should see the WebGL build that comes with this repository

### Building an executable client
* Download the client package
* Create a new unity project and import the package
* Test it in the editor first
* Build an executable for your system File > build settings > Build
* On MacOS you can't open multiple copies (instances) of the same program by double clicking, you have to open the terminal at the folder and launch the app with the -n parameter: ```open -n game.app```
* On Windows you may have to hold *shift* when double clicking on the executable

You should see the game networking locally and even communicating between Unity editor, executable, and browser builds. 

**Note:** For testing purposes it's a good idea to build the project as windowed (and not fullscreen, which is default) and resizable so you can easily swap between instances. Edit > Project settings > Player.


### Building a WebGL client
Javascript is primarily meant for browser applications while Unity is mostly used for desktop and mobile. 
However Unity can build for WebGL if you install the proper component. It's just a bit more awkward.

* socket.io requires a library on client side to work. Since it's not a standard Unity feature you will need to include it in a custom [WebGL template](https://docs.unity3d.com/Manual/webgl-templates.html) which is the html page that embeds the game.
You'll find two template in the Assets folder of the client under *WebGLTemplates*. You can modify them like normal html.
The templates simply include this line that points to the library the root folder of the server:
`<script src="/socket.io/socket.io.js"></script>`

Make sure you select the template that matches your version since Unity 2019 and 2020 are different:
*Unity > Project settings > Player > WebGL (html5 icon) > Resolution and Presentation > WebGL template*

* Switch to WebGL: *file > build, switch to WebGL > wait a few minutes*. 

* **Make sure your server.js is not currently running** otherwise Unity may not be able to overwrite.

* Make sure add the current scene is added and hit build. 
You want to build it into the *public* folder of this project so that index.html is directly in the public folder (not a subfolder. Point to the current "public" and overwrite.
You can find more info [here](https://docs.unity3d.com/Manual/webgl-building.html).


## Networking with Glitch
You can use Glitch to transfer data between clients even if the project isn't running on a browser.

* Clone this repository and import it from glitch.

* Make sure that the Unity client is pointing at your glitch address.
In the Unity Scene, on the SocketIO component of the Main change the url to your glitch address eg:

`testsocket.glitch.me`

Of course replace *testsocket* with your own url. Don't add http or slashes.

**The port number should be empty** if a port number is specified, glitch will refuse the connection. I don't know why.

Always keep in mind that Glitch projects go to sleep when inactive so they may require a minute or two to wake up.

**Check SSL Enabled** it's not necessary if you are testing it locally but if not checked it will cause issues with publishing online.



## JSON and Serializing

socket.io transmits data via JSON, a text format that matches javascript object structures. Example:

```JSON
{
"stringVariableName":"Best game",
"numberVariable":100,
"playerIds":["zDHsXx9dq-UIeSo4AAAL"],
"players":[{"x":164.5037,"y":297.1719,"vX":0,"vY":0,"angle":0,"state":1,"counter":-1}]
}
```

However, while JS is dynamically typed, Unity always needs to know the variable types. Unity can parse a JSON string (ie: turn into an object) only if the data structure it contains is *serialized* as a Class. Basically, you need to create class that match the data you receive. See the classes at the very bottom of Main.cs.

Unity can't serialize *dictionary* variables, which is unfortunate because socket.io stores client information using id as properties and Dictionaries would come handy. You can see workaround in server.js and on the JSON snippet above: I'm tracking the player states with an array of id and a corresponding array of objects.

## Server side logic

Aside of the inconvenience of switching between Unity C# and node.js, having a "dumb" Unity client prevents you from using some of the most valuable features of the 3D engine such as physics, collision detection and such which will have to be implemented in node. The client here is only a fancy renderer.  

