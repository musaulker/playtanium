
var Playtanium2 = {}; // Our top level namespace for this app.

/*
 *	Client Side Database Business...
 */

Playtanium2.db = null;

try 
{
    if (window.openDatabase) 
	{
        Playtanium2.db = openDatabase("playtanium", "2.0", "Playtanium 2", 200000);
        if (!Playtanium2.db)
		{
            alert("Failed to open the database on disk.  This is probably because the version was bad or there is not enough space left in this domain's quota");
		}
    } 
	else
	{
        alert("Couldn't open the database. Please try with a WebKit nightly with this feature enabled");
	}
} 
catch(err) 
{	
	alert(err);
}



/*
 *	Youtube Business...
 */

// allowScriptAccess must be set to allow the Javascript from one 
// domain to access the swf on the youtube domain

var params = { allowScriptAccess: "always" };

// this sets the id of the object or embed tag to 'myytplayer'.
// You then use this id to access the swf and make calls to the player's API

window.onYouTubePlayerReady = function(playerId)
{
	ytplayer = document.getElementById("myytplayer");
	ytplayer.loadVideoById(Playtanium2.Player.currentVideo.id, 0);
	
	Playtanium2.Player.updateProgressInterval = setInterval(Playtanium2.Player.updateProgressBar, 200);
	//ytPlaytanium2.Player.addEventListener("onStateChange", "onytplayerStateChange");
};	

var atts = { id: "myytplayer" };
swfobject.embedSWF("http://www.youtube.com/apiplayer?enablejsapi=1&amp;playerapiid=ytplayer", 
                 "ytapiplayer", "100%", "100%", "8", null, null, params, atts);


/*
 *	Player Business...
 */

Playtanium2.Player = {

	isLocalSearch: false,
	bookmarkData: {},
	updateFlag: true,
	leftPos: 0,
	rightPos: 0,
	
	currentVideo: {

		id: "AOfwnFSWbwM",
		href: "",
		title: "Appcelerator!",
		thumbNail: "",
		description: "The appceleration of all mankind.",
		position: 0
	},
	
	updateProgressBar: function()
	{
		if (ytplayer && ytplayer.getCurrentTime) 
		{
			var currentPosition = ytplayer.getCurrentTime();
			var unitPosition = ytplayer.getDuration() / 100;
			
			// Logger.info((currentPosition / unitPosition) - 48)
			App.getControl("progressBar", "jquery_slider", function()
			{
				this.value(currentPosition / unitPosition);
			});
		}
	},

	Init: function()
	{
	    Playtanium2.db.transaction(function(tx) 
		{				
			tx.executeSql(
				Playtanium2.Player.SQL.createBookmarks, 
				[], 
				function(result) 
				{
            	}
			);
		});
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

Playtanium2.Player.Init();

App.getControl(
	"progressBar", 
	"jquery_slider",
	function()
	{
		var self = this; 
		this.option("slide", function() 
		{ 
				clearInterval(Playtanium2.Player.updateProgressInterval);
				ytplayer.seekTo(self.value() / 100 * ytplayer.getDuration(), true);
				Playtanium2.Player.updateProgressInterval = setInterval(Playtanium2.Player.updateProgressBar, 200);
		});
	}
);

App.getControl(
	"volumeBar", 
	"jquery_slider",
	function()
	{
		var self = this; 

		this.option("slide", function() 
		{ 
				ytplayer.setVolume(self.value());
		});
	}
);


/*
 * Messaging...
 */

$MQL("l:player.stop", function(msg)
{ 
	Playtanium2.Player.currentVideo.position = 0;
	ytplayer.stopVideo();
	ytplayer.clearVideo();
});

$MQL("l:player.play", function(msg)
{

	if (ytplayer && Playtanium2.Player.currentVideo.position != 0)
	{
		ytplayer.playVideo();
	}
	else if(ytplayer)
	{
		//jQuery("#progressBarHandle").get(0).style.left = "-45px";
		ytplayer.loadVideoById(Playtanium2.Player.currentVideo.id, 0);
	}
});

$MQL("l:player.pause", function(msg)
{
	Playtanium2.Player.currentVideo.position = ytplayer.getCurrentTime();	
	
	ytplayer.pauseVideo();	
});

$MQL("l:player.replay", function(msg)
{
	//jQuery("#progressBarHandle").get(0).style.left = "-45px";
	ytplayer.loadVideoById(Playtanium2.Player.currentVideo.id, 0);	
});

$MQL("r:player.load", function(msg)
{	
	//jQuery("progressBarHandle").get(0).style.left = "-45px";
	ytplayer.loadVideoById(Playtanium2.Player.currentVideo.id, 0);
});

$MQL("l:player.bookmarkCurrent", function(msg)
{
    Playtanium2.db.transaction(function(tx) 
	{	
		tx.executeSql(
			Player.SQL.addBookmark, 
			[
				currentVideo.href, 
				currentVideo.title, 
				currentVideo.description, 
				currentVideo.thumbNail
			], 
			function(result) 
			{
				Playtanium2.Player.getBookmarkData();
	    	}
		);
	});
});

$MQL("l:player", function(msg)
{
	//jQuery("#progressBarHandle").get(0).style.left = "-45px";
	if(msg.payload.mode == "search")
	{
		Playtanium2.Player.isLocalSearch = false;
	}
	else if(msg.payload.mode == "bookmarks")
	{
		Playtanium2.Player.isLocalSearch = true;
	}
});

$MQL("l:player.search", function(msg)
{
	if (Playtanium2.Player.searchTimeout) {
		clearTimeout(Playtanium2.Player.searchTimeout);
	}
	
	Playtanium2.Player.searchTimeout = setTimeout(function(){
		Playtanium2.Player.search();
	}, 150);

});


Playtanium2.Player.search = function(refreshAll)
{
	
	$MQ("l:searching", { on: true });

    Playtanium2.db.transaction(function(tx)
    {
		//if(Playtanium2.Player.localUpdate) // Performance tuning here...
		//{
			tx.executeSql(Playtanium2.Player.SQL.getBookmarks, ["%" + jQuery("#searchInput").get(0).value + "%"], 
			function(tx, result)
			{
				var bookmarkVideoData = {};
				bookmarkVideoData.feed = {};
				bookmarkVideoData.feed.entry = [];

			 	for (var i = 0; i < result.rows.length; ++i) 
				{
					var row = result.rows.item(i);

					bookmarkVideoData.feed.entry.push({

						id: row['id'],
						link: [{
							href: row['href']
						}],
						media$group: {

							media$title: {
								$t: row['title']
							},
							media$description: {
								$t: row['description']
							},
							media$thumbnail: [{ url: row['thumbNailURL']}]
						}
					});
				}
			
				queryGoogle(bookmarkVideoData);
				
			});
		//}
		//else
		//{
		//	queryGoogle();
		//}

		function queryGoogle(bookmarkVideoData)
		{
			if (Playtanium2.Player.isLocalSearch == true)
			{
				Playtanium2.Player.buildVideoData({ refresh: refreshAll, bookmarks: bookmarkVideoData });
			}
			else
			{
				swiss.ajax({
				  	url: "http://gdata.youtube.com/feeds/api/videos",
					data: 
					{	
						"q": jQuery("#searchInput").get(0).value,
						"max-results": 6,
						"alt": "json"
					},		
				  	cache: false,

				  	success: function(videoData)
					{
				    	Playtanium2.Player.buildVideoData({ refresh: refreshAll, videos: videoData, bookmarks: bookmarkVideoData });
				  	},
					complete: function()
					{
					}
				});

			}
		}
	});
			
}


Playtanium2.Player.buildVideoData = function(params)
{
	if(Playtanium2.Player.isLocalSearch)
	{
		jQuery("#bookmarkResults").get(0).innerHTML = "";
	}
	else
	{
		jQuery("#searchResults").get(0).innerHTML = "";
	}

	var videoData = params.videos || params.bookmarks;

	if(videoData && typeof(videoData) != "object")
	{
		// if video data exists, but it isn't an object, we probably made a query to google, but jquery didn't turn it into an object.
		videoData = eval("(" + videoData + ")");

		if(!videoData.feed)
		{
			// if there is an object, but there is no feed, there is nothing to do...
			return;
		}
	}

	swiss.each(videoData.feed.entry, function(i)
	{
		var self = this;
		
		var mediaItem = document.createElement("div");
		mediaItem.className = "mediaItem";
		mediaItem.isBookmarked = false;
		
		mediaItem.onclick = (function()
		{
			Playtanium2.Player.currentVideo.id = self.link[0].href.substr(self.link[0].href.lastIndexOf("=") + 1, self.link[0].href.length);
			$MQ("l:player", {
				mode: "play",
				text: self.media$group.media$title.$t
			});
			
			$MQ("l:player.play", { bookmarked: self.isBookmarked });
			
			Playtanium2.Player.currentVideo.href = self.link[0].href;
			Playtanium2.Player.currentVideo.title = self.media$group.media$title.$t;
			Playtanium2.Player.currentVideo.description = self.media$group.media$description.$t;
			Playtanium2.Player.currentVideo.thumbNail = self.media$group.media$thumbnail[0].url;
			
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
		thumbNail.src = this.media$group.media$thumbnail[0].url || '';
		thumbNail.className = "thumbNail";
		
		var title = document.createElement("div");
		title.className = "mediaTitle";
		title.innerText = this.media$group.media$title.$t || 'No Title';
		
		var description = document.createElement("div");
		description.className = "mediaDescription";
		description.innerText = this.media$group.media$description.$t.substr(0, 255) || 'No Description';
		
		mediaItem.appendChild(thumbNail);
		mediaItem.appendChild(title);
		mediaItem.appendChild(description);
		
		if (Playtanium2.Player.isLocalSearch) 
		{
			var removeIcon = document.createElement("img");
			removeIcon.src = "images/player/bookmarked.png";
			removeIcon.className = "activeBookMark";
			removeIcon.title = "Remove";
			removeIcon.onclick = (function()
			{
				event.cancelBubble = true;
			    Playtanium2.db.transaction(function(tx) 
				{
					tx.executeSql(
						Playtanium2.Player.SQL.deleteBookmark, 
						[
							self.id
						],
						function()
						{
							// update both screens...
							$MQ("l:player.search");
						});
				});
				
			});
			
			mediaItem.isBookmarked = true;
			
			mediaItem.appendChild(removeIcon);					

			jQuery("#bookmarkResults").get(0).appendChild(mediaItem);
		}
		else
		{
			var bookMarkIcon = document.createElement("img");
			
			bookMarkIcon.className = "activeBookMark";
			bookMarkIcon.title = "Bookmark";
			
			if (params.bookmarks.feed && params.bookmarks.feed.entry.length > 0) 
			{
				for(var i=0; i < params.bookmarks.feed.entry.length; i++)
				{
					if (params.bookmarks.feed.entry[i].link[0].href == this.link[0].href) 
					{
						bookMarkIcon.src = "images/player/bookmarked.png";
						bookMarkIcon.onclick = (function(){
							event.cancelBubble = true;

							Playtanium2.db.transaction(function(tx) 
							{
								var id = 
													
					            tx.executeSql(
									Playtanium2.Player.SQL.deleteBookmark, 
									[
										params.bookmarks.feed.entry[i].id
									],
									function(tx)
									{										
										$MQ("l:player.search");
									}
								);
							});
						});
						
						mediaItem.isBookmarked = true;
						
						break;
					}
					else 
					{	
						bookMarkIcon.src = "images/player/bookmarks.png";
						bookMarkIcon.onclick = function(){
							event.cancelBubble = true;
							addBookMark();
						};
					}
				}
			}
			else
			{
				bookMarkIcon.src = "images/player/bookmarks.png";
				bookMarkIcon.onclick = function(){
							event.cancelBubble = true;
							addBookMark();
						};
			}
			
			var addBookMark = (function()
			{

			    Playtanium2.db.transaction(function(tx) 
				{				
		            tx.executeSql(
						Playtanium2.Player.SQL.addBookmark, 
						[
							self.link[0].href, 
							self.media$group.media$title.$t, 
							self.media$group.media$description.$t, 
							self.media$group.media$thumbnail[0].url
						], 
						function(result) 
						{
							$MQ("l:player.search");
		            	}
					);
				});

			});

			mediaItem.appendChild(bookMarkIcon);		
			
			jQuery("#searchResults").get(0).appendChild(mediaItem);

		}
	});
	
	$MQ("l:searching", { on: false });

}

function dragHack() {

	var offsetx, offsety, handler;

	var defaultHandler = function(target,x,y)
	{
		if (y > 30) return false;
		if (jQuery(target).is(':input,img')) return false;
		return true;
	};

	function mover(e)
	{
		window.moveBy(e.clientX-offsetx,e.clientY-offsety);
		return false;
	}

	function cancel()
	{
		jQuery(document).unbind('mousemove',mover);
	}

	jQuery(document).bind('mousedown',function(e)
	{
		if (!handler) return; // allow this to be turned off by setting null
		var moveable = handler(e.target,e.clientX,e.clientY);
		if (moveable)
		{
			offsetx = e.clientX;
			offsety = e.clientY;
			jQuery(document).bind('mousemove',mover);
			jQuery(document).bind('mouseup',cancel);
		}
	});

	handler = defaultHandler;
}

dragHack();

document.onselectstart = function() { return false; };
