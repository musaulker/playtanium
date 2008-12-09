
var currentVideo = {

	id: "AOfwnFSWbwM",
	href: "",
	title: "Appcelerator!",
	thumbNail: "",
	description: "The appceleration of all mankind.",
	position: 0
};

// allowScriptAccess must be set to allow the Javascript from one 
// domain to access the swf on the youtube domain

var params = { allowScriptAccess: "always" };

// this sets the id of the object or embed tag to 'myytplayer'.
// You then use this id to access the swf and make calls to the player's API

window.onYouTubePlayerReady = function(playerId)
{
	ytplayer = document.getElementById("myytplayer");
	ytplayer.loadVideoById(currentVideo.id, 0);
	
	//setInterval(updateytplayerInfo, 250);
	//ytplayer.addEventListener("onStateChange", "onytplayerStateChange");
};	

var atts = { id: "myytplayer" };
swfobject.embedSWF("http://www.youtube.com/apiplayer?enablejsapi=1&amp;playerapiid=ytplayer", 
                 "ytapiplayer", "100%", "100%", "8", null, null, params, atts);

document.onselectstart = function() { return false; };

var Player = null;

ti.ready(function() {

   ti.Extras.setDraggableRegionHandler(function (target,x,y)
   {
           return (target.id == "n" || target.id == "nw" || target.id == "ne" || target.id == "mediaInformation");
   });


	Appcelerator.Compiler.registerCustomAction('close',
	{
		execute: function(id, action, params)
		{
	        ti.Window.currentWindow.close();
		}
	});
	
	Player = {
	
		isLocalSearch: false,
		db: new ti.Database,
		bookmarkData: {},
		updateFlag: true,
		leftPos: 0,
		rightPos: 0,
		
		hConstraint: function(left, right)
		{
			event.cancelBubble = true;
			Player.leftPos = left;
			Player.rightPos = right;
			
			if(event.clientX < left)
			{
				$("progressBarHandle").style.right = left + "px";
				$("progressBarHandle").ondragend();
				return false;
			}
			
			if(event.clientX > right)
			{
				$("progressBarHandle").style.right = right + "px";
				$("progressBarHandle").ondragend();		
				return false;
			}
		},
		
		jumpTo: function()
		{
			var offsetPosition = event.x - 148;
			var unitPosition = $("progressBar").offsetWidth/100;
			$("progressBarHandle").style.left = offsetPosition + "px";
			ytplayer.seekTo(offsetPosition+225 / unitPosition, true);
			return false;
		},
		
		cueVideo: function()
		{
			if(event.x > Player.leftPos && event.y < Player.rightPos)
			{
				$("progressBarHandle").style.right = event.x + "px";
			}
		},
	
		getBookmarkData: function()
		{
			var rs = Player.db.execute(Player.SQL.getBookmarks, ["%" + $("searchInput").value + "%"]);
			
			var transport = {};
			transport.feed = {};
			transport.feed.entry = [];
			
			while (rs.isValidRow()) 
			{
				transport.feed.entry.push({
				
					id: rs.field(0),
					link: [{
						href: rs.field(1)
					}],
					media$group: {
					
						media$title: {
							$t: rs.field(2)
						},
						media$description: {
							$t: rs.field(3)
						},
						media$thumbnail: [{ url: rs.field(4)}]
					}
				});
				
				rs.next();
			}
			Player.bookmarkData = transport;
		},	
		
		Init: function()
		{
			Player.db.open("playtainium");
			// Player.db.execute('DROP TABLE Bookmarks');
			Player.db.execute(Player.SQL.createBookmarks);
			Player.getBookmarkData();
		},
		
		SQL: 
		{
			addBookmark: "INSERT INTO Bookmarks (href, title, description, thumbNailURL) VALUES (?, ?, ?, ?)",
			deleteBookmark: "DELETE FROM Bookmarks WHERE id=?",	
			getBookmarks: "SELECT id, href, title, description, thumbNailURL FROM Bookmarks WHERE title LIKE ? LIMIT 6",
			createBookmarks: "CREATE TABLE IF NOT EXISTS Bookmarks" +
				           " (id INTEGER PRIMARY KEY AUTOINCREMENT, href TEXT, title TEXT, description TEXT, thumbNailURL TEXT)"
		}
	};
	
	Player.Init();


	
	$MQL("l:player.stop", function(msgId, msgData)
	{ 
		currentVideo.position = 0;
		ytplayer.stopVideo();
		ytplayer.clearVideo();
	});

	$MQL("l:player.play", function(msgId, msgData)
	{
		if (currentVideo.position != 0) 
		{
			ytplayer.playVideo();
		}
		else 
		{
			ytplayer.loadVideoById(currentVideo.id, 0);
		}
	});

	$MQL("l:player.pause", function(msgId, msgData)
	{
		currentVideo.position = ytplayer.getCurrentTime();	
		
		ytplayer.pauseVideo();	
	});

	$MQL("l:player.replay", function(msgId, msgData)
	{
		ytplayer.loadVideoById(currentVideo.id, 0);	
	});
	
	$MQL("r:player.load", function(msgId, msgData)
	{	
		ytplayer.loadVideoById(currentVideo.id, 0);
	});
	
	$MQL("l:player.bookmarkCurrent", function(msgId, msgData)
	{
		Player.db.execute(Player.SQL.addBookmark, [
			currentVideo.href, 
			currentVideo.title, 
			currentVideo.description, 
			currentVideo.thumbNail]);
	});
	
	$MQL("l:player", function(msgId, msgData)
	{			
		if(msgData.mode == "search")
		{
			Player.isLocalSearch = false;
		}
		else if(msgData.mode == "bookmarks")
		{
			Player.isLocalSearch = true;
		}
	});
	
	$MQL("l:player.search", function(msgId, msgData)
	{
		if (Player.searchTimeout) {
			clearTimeout(Player.searchTimeout);
		}
		
		Player.searchTimeout = setTimeout(function(){
			Player.search();
		}, 150);
	
	});
	
	Player.search = function()
	{
		$MQ("l:searching", { on: true });
		
		if (Player.updateFlag == true) 
		{
			Player.getBookmarkData();
			Player.updateFlag = false;
		}			
			
		if (Player.isLocalSearch == false)
		{
			var ajax = new Ajax.Request("http://gdata.youtube.com/feeds/api/videos", {
				method: 'GET',
				crossSite: true,
				parameters: {
					
					"q": $("searchInput").value,
					"max-results": 6,
					"alt": "json"
					
				},
				onLoading: function()
				{
					//startup
				},
				onSuccess: function(transport)
				{
					Player.buildVideoData(transport, false);
					
				},
				onFailure: function(transport)
				{
					//fail
					
				},
				onComplete: function()
				{
					$MQ("l:searching", { on: false });
				}
			});
		}
		else
		{
			Player.getBookmarkData();
			Player.buildVideoData(Player.bookmarkData, true);
		}		
	}
	
	Player.buildVideoData = function(transport, isLocal)
	{
		var videoData = null;
		
		if (isLocal == false) 
		{
			$("searchResults").innerHTML = "";
			videoData = eval("(" + transport.responseText + ")");
			
		}
		else
		{
			$("bookmarkResults").innerHTML = "";
			$MQ("l:searching", { on: false });
			
			videoData = transport;
		}
		
		videoData.feed.entry.each(function(item) // Protoplasim
		{
			var mediaItem = document.createElement("div");
			mediaItem.className = "mediaItem";
			mediaItem.isBookmarked = false;
			
			mediaItem.onclick = (function()
			{
				currentVideo.id = item.link[0].href.substr(item.link[0].href.lastIndexOf("=") + 1, item.link[0].href.length);
				$MQ("l:player", {
					mode: "play",
					text: item.media$group.media$title.$t
				});
				
				$MQ("l:player.play", { bookmarked: this.isBookmarked });
				
				currentVideo.href = item.link[0].href;
				currentVideo.title = item.media$group.media$title.$t;
				currentVideo.description = item.media$group.media$description.$t;
				currentVideo.thumbNail = item.media$group.media$thumbnail[0].url;
				
			});
			
			mediaItem.onmouseover = function()
			{
				this.style.backgroundColor = "#222222";
				this.getElementsByTagName("img")[1].style.display = "block";
			};
			
			mediaItem.onmouseout = function()
			{
				this.style.backgroundColor = "transparent";
				this.getElementsByTagName("img")[1].style.display = "none";
			};
			
			var thumbNail = document.createElement("img");
			thumbNail.src = item.media$group.media$thumbnail[0].url;
			thumbNail.className = "thumbNail";
			
			var title = document.createElement("div");
			title.className = "mediaTitle";
			title.innerText = item.media$group.media$title.$t;
			
			var description = document.createElement("div");
			description.className = "mediaDescription";
			description.innerText = item.media$group.media$description.$t.substr(0, 255);
			
			mediaItem.appendChild(thumbNail);
			mediaItem.appendChild(title);
			mediaItem.appendChild(description);
			
			if (isLocal == false) 
			{
				var bookMark = document.createElement("img");
				
				bookMark.className = "activeBookMark";
				bookMark.title = "Bookmark";
				
				if (Player.bookmarkData.feed.entry.length > 0) 
				{
					for(var i=0; i < Player.bookmarkData.feed.entry.length; i++)
					{
						if (Player.bookmarkData.feed.entry[i].link[0].href == item.link[0].href) 
						{
							bookMark.src = "images/player/bookmarked.png";
							bookMark.onclick = (function(){
								event.cancelBubble = true;
								Player.db.execute(Player.SQL.deleteBookmark, [Player.bookmarkData.feed.entry[i].id]);
								
								Player.updateFlag = true;
								$MQ("l:player.search");
							});
							
							mediaItem.isBookmarked = true;
							
							break;
						}
						else 
						{	
							bookMark.src = "images/player/bookmarks.png";
							bookMark.onclick = function(){
								event.cancelBubble = true;
								addBookMark();
							};
						}
					}
				}
				else
				{
					bookMark.src = "images/player/bookmarks.png";
					bookMark.onclick = function(){
								event.cancelBubble = true;
								addBookMark();
							};
				}
				
				var addBookMark = (function()
					{	
						Player.db.execute(Player.SQL.addBookmark, [
							item.link[0].href, 
							item.media$group.media$title.$t, 
							item.media$group.media$description.$t, 
							item.media$group.media$thumbnail[0].url]);
						
						Player.updateFlag = true;
						$MQ("l:player.search");
					});						
				
				mediaItem.appendChild(bookMark);		
				
				$("searchResults").appendChild(mediaItem);

			}
			else
			{
				var remove = document.createElement("img");
				remove.src = "images/player/bookmarked.png";
				remove.className = "activeBookMark";
				remove.title = "Remove";
				remove.onclick = (function()
				{
					event.cancelBubble = true;
					
					Player.db.execute(Player.SQL.deleteBookmark, [item.id]);
					
					Player.updateFlag = true;
					$MQ("l:player.search");
				});			
				
				mediaItem.isBookmarked = true;
				
				mediaItem.appendChild(remove);					

				$("bookmarkResults").appendChild(mediaItem);
			}

		});
	}	
});

