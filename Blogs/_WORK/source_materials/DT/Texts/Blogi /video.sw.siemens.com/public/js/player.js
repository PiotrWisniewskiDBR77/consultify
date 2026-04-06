(function (window, jwplayer) {
  var trackIntervals = [];
  var video = window.__VIDEO__;
  var platform = window.__PLATFORM__;

  var player = jwplayer(document.getElementById("player")).setup({
    autostart: video.autoplay || false,
    playbackRateControls: true,
    image: video.image,
    mediaId: video.id,
    sources: video.sources,
    title: video.resource_title,
    tracks: video.tracks || [],
    plugins: {
      "/public/js/jwplayer.analytics.js": {
        player_name: "Mentor Video Player",
        videoId: video.id,
        segments: [25, 50, 75, 100],
        platform: platform,
      },
    },
  });

  // checks to see if a &t= query param is set, then seeks ahead to the given start time
  if (video.startTime && video.startTime < (video.length || 0)) {
    player.on("firstFrame", () => {
      player.seek(video.startTime);
    });
  }

  function getURLOrigin(url) {
    var a = document.createElement("a");
    a.href = url;
    return a.origin || a.protocol + "//" + a.hostname;
  }

  function messageParent(message) {
    window.top.postMessage(message, getURLOrigin(document.referrer));
  }

  if (window.top !== window.self) {
    player.on("play", function () {
      messageParent({
        player: {
          event: "play",
        },
      });
    });
    player.on("complete", function () {
      messageParent({
        player: {
          event: "complete",
        },
      });
    });
  }
})(window, jwplayer);
