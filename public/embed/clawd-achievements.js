/* Clawd Achievements — embed snippet (vanilla JS, zero dependencies)
 *
 * Drop into any host app:
 *   <script src="https://<hub-domain>/embed/clawd-achievements.js"></script>
 *   window.ClawdAchievements.check(userWalletAddress);
 *
 * check(wallet) asks the Hub for earned-but-unclaimed achievements and, if
 * any exist, pops an "Achievement Unlocked" overlay — one at a time — with a
 * single Claim button. Claims are backend-submitted: the user pays no gas and
 * sees no wallet popup.
 *
 * The Hub base URL is derived from this script's own src, so no config is
 * needed. Override with window.ClawdAchievements.configure({ baseUrl }).
 *
 * NOTE: earning is reported by the HOST APP'S SERVER via POST /api/report
 * with the shared secret. Never call /api/report from the browser.
 */
(function () {
  "use strict";

  var baseUrl = (function () {
    try {
      var src =
        (document.currentScript && document.currentScript.src) || "";
      return src ? new URL(src).origin : "";
    } catch (e) {
      return "";
    }
  })();

  var TIER = {
    1: { name: "Common", color: "#d99a5b" },
    2: { name: "Rare", color: "#b9d4ea" },
    3: { name: "Legendary", color: "#ffd75e" },
  };

  var queue = [];
  var wallet = null;
  var root = null;
  var styled = false;

  function injectStyles() {
    if (styled) return;
    styled = true;
    var css =
      "@keyframes caPop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.06);opacity:1}100%{transform:scale(1)}}" +
      "@keyframes caFall{from{transform:translateY(-5vh) rotate(0)}to{transform:translateY(110vh) rotate(540deg);opacity:.5}}" +
      "@keyframes caSpin{to{transform:rotate(360deg)}}" +
      ".ca-backdrop{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif}" +
      ".ca-card{animation:caPop .5s cubic-bezier(.2,.9,.3,1.2);background:#161a22;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:24px;max-width:360px;width:100%;text-align:center;color:#e8e6df;box-shadow:0 24px 60px rgba(0,0,0,.5)}" +
      ".ca-art{width:130px;height:130px;border-radius:12px;margin:0 auto 14px;object-fit:cover;display:block;border:2px solid rgba(255,255,255,.15)}" +
      ".ca-kicker{font-size:11px;letter-spacing:.18em;text-transform:uppercase;margin:0 0 6px;font-weight:600}" +
      ".ca-name{font-size:20px;font-weight:700;margin:0 0 6px}" +
      ".ca-desc{font-size:13px;color:rgba(232,230,223,.6);margin:0 0 14px;line-height:1.45}" +
      ".ca-btn{cursor:pointer;border:0;border-radius:10px;width:100%;padding:11px 20px;font-size:14px;font-weight:700;color:#0d0f14}" +
      ".ca-btn[disabled]{opacity:.5;cursor:default}" +
      ".ca-link{display:inline-block;margin-top:10px;font-size:13px;text-decoration:underline}" +
      ".ca-err{color:#fca5a5;font-size:13px;margin:0 0 10px}" +
      ".ca-spin{display:inline-block;width:13px;height:13px;border:2px solid rgba(0,0,0,.25);border-top-color:rgba(0,0,0,.8);border-radius:50%;animation:caSpin .8s linear infinite;vertical-align:-2px;margin-right:6px}" +
      ".ca-confetti{position:absolute;top:-5%;width:6px;height:11px;border-radius:2px;animation:caFall linear forwards;pointer-events:none}";
    var el = document.createElement("style");
    el.textContent = css;
    document.head.appendChild(el);
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function close() {
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    showNext();
  }

  function confetti(container, color) {
    var palette = [color, "#e8e6df", "#7fa8c9"];
    for (var i = 0; i < 22; i++) {
      var piece = el("span", "ca-confetti");
      piece.style.left = ((i * 41) % 100) + "%";
      piece.style.background = palette[i % 3];
      piece.style.animationDelay = (i % 8) * 0.15 + "s";
      piece.style.animationDuration = 2 + (i % 5) * 0.4 + "s";
      container.appendChild(piece);
    }
  }

  function showNext() {
    if (root || queue.length === 0) return;
    injectStyles();
    var a = queue.shift();
    var tier = TIER[a.tier] || TIER[1];

    root = el("div", "ca-backdrop");
    var card = el("div", "ca-card");
    card.style.borderColor = tier.color + "55";

    if (a.tier === 3) confetti(root, tier.color);

    if (a.imageURI) {
      var img = document.createElement("img");
      img.className = "ca-art";
      img.src = a.imageURI;
      img.alt = a.name;
      card.appendChild(img);
    }

    var kicker = el("p", "ca-kicker", "Achievement Unlocked");
    kicker.style.color = tier.color;
    card.appendChild(kicker);
    card.appendChild(el("h3", "ca-name", a.name));
    card.appendChild(el("p", "ca-desc", a.description));

    var errBox = el("p", "ca-err", "");
    errBox.style.display = "none";
    card.appendChild(errBox);

    var btn = el("button", "ca-btn", "Claim");
    btn.style.background = tier.color;
    card.appendChild(btn);

    btn.addEventListener("click", function () {
      btn.disabled = true;
      btn.innerHTML = '<span class="ca-spin"></span>Claiming…';
      errBox.style.display = "none";

      fetch(baseUrl + "/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: wallet, achievementId: a.id }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok || !result.data.ok) {
            throw new Error(
              result.data.error || "Something went wrong. Please try again."
            );
          }
          card.innerHTML = "";
          var done = el("p", "ca-name", "✓ Added to your Trophy Case");
          done.style.color = tier.color;
          card.appendChild(done);
          if (result.data.edition && a.maxSupply !== "0") {
            card.appendChild(
              el(
                "p",
                "ca-desc",
                "You are #" + result.data.edition + " of " + a.maxSupply
              )
            );
          }
          var link = el("a", "ca-link", "View badge");
          link.style.color = tier.color;
          link.href = baseUrl + "/achievement/" + a.id;
          link.target = "_blank";
          link.rel = "noopener";
          card.appendChild(link);
          var cont = el("button", "ca-btn", "Continue");
          cont.style.background = "transparent";
          cont.style.color = "#e8e6df";
          cont.style.border = "1px solid rgba(255,255,255,.2)";
          cont.style.marginTop = "14px";
          cont.addEventListener("click", close);
          card.appendChild(cont);
        })
        .catch(function (e) {
          btn.disabled = false;
          btn.textContent = "Retry";
          errBox.textContent = e && e.message ? e.message : "Claim failed.";
          errBox.style.display = "block";
        });
    });

    root.appendChild(card);
    document.body.appendChild(root);
  }

  window.ClawdAchievements = {
    configure: function (opts) {
      if (opts && opts.baseUrl) baseUrl = opts.baseUrl.replace(/\/$/, "");
    },
    check: function (walletAddress) {
      if (!walletAddress || !baseUrl) return Promise.resolve(0);
      wallet = walletAddress;
      return fetch(
        baseUrl + "/api/pending?wallet=" + encodeURIComponent(walletAddress)
      )
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          var items = (data && data.pending) || [];
          if (items.length === 0) return 0;
          queue = queue.concat(items);
          showNext();
          return items.length;
        })
        .catch(function () {
          return 0;
        });
    },
  };
})();
