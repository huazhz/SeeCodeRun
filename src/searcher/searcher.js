/**
 * Created by DavidIgnacio on 4/18/2017.
 */
import {customElement} from 'aurelia-framework';
import {draggable} from 'jquery-ui';

@customElement('pastebin')
export class Searcher {
  searcherSelector = "#searcher";
  isFirstSearch = true;
  searcherQueryDefaultHeight = 38;
  searcherMaxHeight = 500;
  currentSearchQuery = "";
  $currentMetagURL = null;
  currentMetagURLKey = null;
  currentURL = null;
  currentPastedText = null;
  currentCopiedText = null;
  sentPastedText = null;
  urls2GlobalMetags = {};
  urls2pastebinMetags = {};
  DEBUG_MODE = false;

  constructor(eventAggregator, firebaseManager) {
    this.eventAggregator = eventAggregator;
    this.firebaseManager = firebaseManager;
  }

  // storing hashes in Firebase, hence normal strings cannot be indexes. null, undefined throw errors
  getStringHashCode(aString) {
    let hash = 0, i, chr;
    if (aString.length === 0) return hash;
    for (i = 0; i < aString.length; i++) {
      chr = aString.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  };

  attached() {
    this.metagsURLsFirebase = this.firebaseManager.makePastebinMetagsURLsFirebase();
    this.globalMetagsURLsFirebase = this.firebaseManager.makeGlobalMetagsURLsFirebase();

    let self = this;
    let gcseCallback = function () {
      if (document.readyState == 'complete') {
        self.onGoogleLoad();
      } else {
        google.setOnLoadCallback(function () {
          self.onGoogleLoad();
        }, true);
      }
    };
    window.__gcse = {
      callback: gcseCallback
    };

    let cx = '001516196410189427601:kz8ylumip-q';
    let gcse = document.createElement('script');
    gcse.type = 'text/javascript';
    gcse.async = true;
    gcse.src = 'https://cse.google.com/cse.js?cx=' + cx;
    let s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(gcse, s);
  }

  onGoogleLoad() {
    let self = this;
    let $searcher = $(this.searcherSelector);
    $(this.searcherSelector + " input.gsc-search-button.gsc-search-button-v2").click(function click() {

      self.currentSearchQuery = $(self.searcherSelector + " input.gsc-input");
      self.onGoogleSearch();
    });
    $(this.searcherSelector + " input.gsc-input").on('keyup', function (e) {
      self.currentSearchQuery = $(self.searcherSelector + " input.gsc-input").val();
      if (e.keyCode == 13) {
        self.onGoogleSearch();
      }
    });

    $(".searcher span.gscb_a").click(function hideResultsContainer() {
        $searcher.height(38);
        $(".searcher .results").hide();
      }
    );

    if (self.DEBUG_MODE) {
      $searcher.css({top: 100, left: 300});
      $searcher.show();
      return;
    }
    $searcher.hide();
    $(".searcher .results").hide();

    self.eventAggregator.subscribe("autoCompleteHidden", payload => {
      clearTimeout(self.hideTimeout);
      if ($searcher.find(":hover").length > 0 || $searcher.find(":focus").length > 0) {
        self.hideTimeout = setTimeout(function () {
            self.eventAggregator.publish('autoCompleteHidden', null);
          }, 2500
        );
        return;
      }
      $searcher.hide();
    });

    //todo AutoComplete did not work, redesign needed
    // self.eventAggregator.subscribe("autoCompleteShown", payload =>{
    //   $searcher.css({top: payload.top, left: payload.left});
    //   $searcher.show();
    //   if(payload.takeFocus){
    //     $(self.searcherSelector+" input.gsc-input").focus();
    //   }
    // });
    //
    self.eventAggregator.subscribe("toggleSearcher", payload => {
      if ($searcher.is(":visible")) {
        $searcher.hide();
      } else {
        payload.top = self.getSearcherPositionTopMax(payload.top);
        $searcher.css({top: payload.top + "px", left: payload.left + "px"});
        $searcher.show();
        if (payload.takeFocus) {
          $(self.searcherSelector + " input.gsc-input").focus();
        }
      }

    });

    self.eventAggregator.subscribe("editorCopyAction", payload => {
      self.currentCopiedText = payload;
    });

    self.eventAggregator.subscribe("editorPasteAction", payload => {
      self.currentPastedText = payload.text;
      // Copy action happened outside of the pastebin editors' reach
      if (self.currentCopiedText !== self.currentPastedText) {
        // User went to a web page via clicking Searcher's search results and has not
        if (self.currentURL && self.currentPastedText !== self.sentPastedText) {
          let isUseful = false;
          console.log("Storing", self.currentURL, self.currentPastedText, self.currentSearchQuery, isUseful);
          self.updateGlobalMetagOnPaste(self.currentURL, self.currentSearchQuery, self.currentPastedText, isUseful);
          self.sentPastedText = self.currentPastedText;
        } else {
          console.log("Error Storing", self.currentURL, self.currentPastedText);
        }
      }
    });

    $searcher.draggable();
    $searcher.hover(
      function mouseenter() {
        clearTimeout(self.hideTimeout);
      },
      function mouseexit() {
        clearTimeout(self.hideTimeout);
        self.hideTimeout = setTimeout(function () {
            self.eventAggregator.publish('autoCompleteHidden', null);
          }, 2500
        );
      }
    );
  }

  onGoogleSearch(isPageClick, isFirstPoll = true, waitForSearchResultsInMs = 1000) {
    let self = this;
    if ($("a.gs-title").length) {
      clearTimeout(self.onGoogleSearchTimeout);
      if (self.isFirstSearch) {
        self.isFirstSearch = false;
        self.onGoogleResults();
      } else {
        if (isFirstPoll) {
          self.onGoogleSearchTimeout = setTimeout(function () {
            self.onGoogleSearch(isPageClick, false);
          }, 2500);
        } else {
          self.onGoogleResults();
        }
      }
    } else {
      clearTimeout(self.onGoogleSearchTimeout);
      self.onGoogleSearchTimeout = setTimeout(function () {
        self.onGoogleSearch(isPageClick, false, 300);
      }, waitForSearchResultsInMs);
    }


  }

  onGoogleResults() {
    let self = this;

    if (!$(`${this.searcherSelector} .results`).is(":visible")) {
      let $searcher = $(this.searcherSelector);
      $searcher.height(500);
      $(`${this.searcherSelector} .results`).show();
    }

    $(this.searcherSelector + " div.gsc-cursor-page").click(function (e) {
      let isPageClick = true;
      //todo have logs of this for research
      self.onGoogleSearch(isPageClick);
    });

    this.appendMetags();
  }

  // avoids overflowing pastebin
  getSearcherPositionTopMax(currentTop) {
    let maxTop = $("#js-editor-code").offset().top + $("#codeContent").height() - 52; // SCR nav-header offset = 52
    if (currentTop + this.searcherMaxHeight > maxTop) {
      currentTop = maxTop - this.searcherMaxHeight;
    }
    return currentTop;
  }

  pushNewMetag(resultURL, metagsURLsFirebase = this.metagsURLsFirebase) {
    let userChoices = {favorited: false, pinned: false};
    let metagRanking = {votes: 0, userChoices: userChoices};
    let pageURL = {url: resultURL, metagRanking: metagRanking};
    let metagURLKey = metagsURLsFirebase.push().set(pageURL).key;
    return metagURLKey;
  }

  pushNewGlobalMetag(resultURL, query) {
    let globalMetagsURLsFirebase = this.globalMetagsURLsFirebase;
    let pastesToQueries = 0; // array with entries ["x()": {hits: 0, contains: [], queries: ["call func": 2, "invoke func":1]}], we show paste super sets
    let searchQueries = {};
    searchQueries[query] = 1;
    let globalMetagRanking = {votes: 0, hits: 1, searchQueries: searchQueries, pastesToQueries: pastesToQueries};
    let globalMetagURL = {url: resultURL, globalMetagRanking: globalMetagRanking};
    let globalMetagURLKey = globalMetagsURLsFirebase.push().set(globalMetagURL).key;
    return globalMetagURLKey;
  }

  updateGlobalMetagOnPaste(resultURL, query, pastedText, isUseful) {
    let pastesToQueries = 0; // array with entries ["x()": {hits: 0, usefulCount:0 contains: [], queries: ["call func": 2, "invoke func":1]}], we show paste super sets
    let metagGlobalURLKey = this.urls2GlobalMetags[resultURL];
    if (!metagGlobalURLKey) {
      console.log("ERROR: global key not found");
      return;
    }
    let pastedTextHash = this.getStringHashCode(pastedText);
    // console.log("paste", JSON.stringify({"p": pastedText}), pastedTextHash);

    let globalMetagsURLsFirebaseRef = this.firebaseManager.makeGlobalMetagsURLsFirebaseByKey(metagGlobalURLKey);
    globalMetagsURLsFirebaseRef.once("value", function onResult(snapshot) {
      let globalMetagURL = snapshot.val();
      globalMetagURL.hits++;
      let pastesToQueries = globalMetagURL.pastesToQueries;
      if (pastesToQueries) {
        if (pastesToQueries[pastedText]) {
          pastesToQueries[pastedText].hits++;
          if (pastesToQueries[pastedText].queries[query]) {
            pastesToQueries[pastedText].queries[query]++;
          } else {
            pastesToQueries[pastedText].queries[query] = 1;
          }

        } else {
          pastesToQueries[pastedText].hits = 1;
          pastesToQueries[pastedText].queries[query] = 1;
          // associate pasted texts
          for (const paste in pastesToQueries.keys()) {
            if (paste.includes(pastedText)) {
              if (pastesToQueries[paste].contains) {
                if (pastesToQueries[paste].contains[pastedText]) {
                  pastesToQueries[paste].contains[pastedText]++;
                } else {
                  pastesToQueries[paste].contains[pastedText] = 1;
                }
              } else {
                let contains = {}
                contains[pastedText] = 1;
                pastesToQueries[paste].contains = contains;
              }

            } else {
              if (pastedText.includes(paste)) {
                if (pastesToQueries[pastedText].contains) {
                  if (pastesToQueries[pastedText].contains[paste]) {
                    pastesToQueries[pastedText].contains[paste]++;
                  } else {
                    pastesToQueries[pastedText].contains[paste] = 1;
                  }
                } else {
                  let contains = {}
                  contains[paste] = 1;
                  pastesToQueries[pastedText].contains = contains;
                }

              }

            }
          }

        }
      } else {
        globalMetagURL.pastesToQueries = {};
        let queries = {};
        queries[query] = 1;
        globalMetagURL.pastesToQueries[pastedText] = {hits: 0, usefulCount: 0, contains: 0, queries: queries};
      }

      globalMetagsURLsFirebaseRef.update(globalMetagURL);
    });
  }
  appendMetags() {
    let self = this;
    let collectedSearchResultURLs = [];
    $("a.gs-title").each(function () {
      let context = this;
      let $element = $(this);
      let resultURL = $(this).attr('href');
      // avoids GCS search results without links
      if (!resultURL) {
        return;
      }
      // avoids GSC duplicates on same page
      if (collectedSearchResultURLs[resultURL]) {
        return;
      }
      collectedSearchResultURLs[resultURL] = true;

      $element.click(function googleResultTitleClick() {
        self.currentURL = resultURL;
        self.currentMetagURLKey = $(this).data("metagURLKey");
        // User is now looking another link

        //todo user copied text should be reset too
        self.sentPastedText = null;
      });

      $element.hover(function hoverIn() {
        $element.addClass("searcher-search-result-highlight");
        clearTimeout(context.timeOut);
        if (!self.$currentMetagURL) {
          self.$currentMetagURL = resultURL;
          $element.popover('show');
        } else {
          if (self.$currentMetagURL !== resultURL) {
            self.$currentMetagURL = resultURL;
            $(".metag-popover").hide();
            $element.popover('show');
          }
        }
      }, function hoverOut() {
        $element.removeClass("searcher-search-result-highlight");
        clearTimeout(context.timeOut);
        context.timeOut = setTimeout(function () {
          self.$currentMetagURL = null;
          $element.popover('hide');
        }, 2500);
      });

      let urlQuery = self.metagsURLsFirebase;
      urlQuery.once("value", function (snapshot) {
          let urls = snapshot;
          if (urls.hasChildren()) {
            // console.log(urls.val());
            let found = false;
            let childrenCount = urls.numChildren();
            urls.forEach(function (child) {
              childrenCount--;
              let data = child.val();
              if (data && data.url === resultURL) {
                let metagURLKey = child.key();
                self.urls2pastebinMetags[resultURL] = metagURLKey;
                self.appendMetagRank(context, $element, metagURLKey);
                found = true;
              }
              if (!found && !childrenCount) {
                let metagURLKey = self.pushNewMetag(resultURL);
                self.urls2pastebinMetags[resultURL] = metagURLKey;
                self.appendMetagRank(context, $element, metagURLKey);
              }
            });
          } else {
            //set urls for the first time
            let metagURLKey = self.pushNewMetag(resultURL);
            self.urls2pastebinMetags[resultURL] = metagURLKey;
            self.appendMetagRank(context, $element, metagURLKey);
          }
        },
        function onError() {
          console.log("Firebase Error: in Appending metags");
        }
      );

      let globalUrlQuery = self.globalMetagsURLsFirebase;
      globalUrlQuery.once("value", function (snapshot) {
          let urls = snapshot;
          if (urls.hasChildren()) {
            // console.log(self.currentSearchQuery, urls.val());
            let found = false;
            let childrenCount = urls.numChildren();
            urls.forEach(function (child) {
              childrenCount--;
              let data = child.val();
              if (data && data.url === resultURL) {
                self.urls2GlobalMetags[resultURL] = child.key();
                found = true;
                if (!data.hits) {
                  data.hits = 0;
                }
                data.hits++;

                if (!data.searchQueries) {
                  data.searchQueries = {};
                }
                if (data.searchQueries[self.currentSearchQuery]) {
                  console.log("hit ", self.currentSearchQuery, data);
                  data.searchQueries[self.currentSearchQuery]++;
                } else {
                  data.searchQueries[self.currentSearchQuery] = 1;
                }

                globalUrlQuery.child(child.key()).update(data);
              }
              if (!found && !childrenCount) {
                self.urls2GlobalMetags[resultURL] = self.pushNewGlobalMetag(resultURL, self.currentSearchQuery);
              }
            });
          } else {
            //set urls for the first time
            self.urls2GlobalMetags[resultURL] = self.pushNewGlobalMetag(resultURL, self.currentSearchQuery);
          }
        },
        function onError() {
          console.log("Firebase Error: in Appending global metags");
        }
      );
      }
    );
    // var popOverOptions = {trigger: "hover"};
    // $('[data-toggle="popover"]').popover(popOverOptions);
  }


  appendMetagRank(context, $element, metagURLKey) {
    // if (true) {
    //   return;
    // }

    let self = this;
    let metagRankTemplate = `
    <div class="metag metagRank" id = "${metagURLKey}">
  <div class="rankingContainer">
         <label class="rankingLabel"></label>
  </div>
  
  <div class="voteContainer">
    <div>
      <div>
       <span class="voteUpContainer">
         <button class="voteButton vote-button btn btn-info fa fa-arrow-up faup">
         </button>
       </span>
     </div>
    <div class="voteCountContainer" >
      <label class="voteCountLabel"> </label>
    </div>  
    <div>
      <span class="voteDownContainer">
        <button class="voteButton vote-button btn btn-info fa fa-arrow-down">
        </button>
      </span>
    </div>
  </div>
 </div>
 
 <div class="userChoicesContainer">    
   <div class="favoriteToggleIcon iconChosenFalse">
     <i class="fa fa-star" ></i>
   </div>
   <div class="pinnedToggleIcon iconChosenFalse">
     <i class="fa fa-thumb-tack"></i>
   </div> 
 </div>
</div>
    `;
    let popoverTemplate = '<div class="popover metag-popover" role="tooltip"><div class="arrow"></div><div class="popover-content"></div></div>'
    $element.attr({
      "data-toggle": "popover",
      "data-placement": "auto left",
      "data-content": metagRankTemplate
    });
    $element.popover({
      trigger: "manual",
      placement: "right",
      title: "1",
      // content: metagRankTemplate,
      container: "body",
      html: true,
      offset: "0 10px",
      template: popoverTemplate
    });
    $element.popover();
    $element.on('inserted.bs.popover', function () {
      $(`#${metagURLKey}`).hover(
        function hoverIn() {
          clearTimeout(context.timeOut);
        },
        function hoverOut() {
          clearTimeout(context.timeOut);
          context.timeOut = setTimeout(function () {
            $element.popover('hide');
          }, 2500);
        }
      );
      self.bindViewListenersToFirebaseMetagPublishers(metagURLKey);
      self.subscribeToFirebaseMetagChangesAndBindToView(metagURLKey);
    });

    $element.data("metagURLKey", metagURLKey);
  }


  subscribeToFirebaseMetagChangesAndBindToView(metagURLKey) {
    let metagsURLFirebaseVote = this.firebaseManager.makeMetagsURLFirebaseVote(metagURLKey);

    metagsURLFirebaseVote.on("value", function (snapshot) {

      let urlData = snapshot.val();
      if (!urlData) return;
      let voteCount = urlData.metagRanking.votes;
      $(`#${metagURLKey} .voteCountLabel`).html(voteCount);

      if (urlData.metagRanking.userChoices.favorited) {
        $(`#${metagURLKey} .favoriteToggleIcon`).addClass('iconChosenTrue');
      } else {
        $(`#${metagURLKey} .favoriteToggleIcon`).removeClass('iconChosenTrue');
      }
      if (urlData.metagRanking.userChoices.pinned) {
        $(`#${metagURLKey} .pinnedToggleIcon`).addClass('iconChosenTrue');
      } else {
        $(`#${metagURLKey} .pinnedToggleIcon`).removeClass('iconChosenTrue');
      }
    });
  }

  bindViewListenersToFirebaseMetagPublishers(metagURLKey) {
    let self = this;
    //console.log("why", $(`#${metagURLKey} > .voteContainer > div > div > .voteUpContainer`));
    $(`#${metagURLKey} > .voteContainer > div > div > .voteUpContainer`).click(function () {
      $(".voteButton").prop("disabled", true);
      self.publishFirebaseURLChanges({metagURLKey: metagURLKey, isVoteAction: true, isVoteUp: true});
    });

    $(`#${metagURLKey} .voteDownContainer`).click(function () {
      $(".voteButton").prop("disabled", true);
      self.publishFirebaseURLChanges({metagURLKey: metagURLKey, isVoteAction: true, isVoteUp: false});
    });

    $(`#${metagURLKey} .favoriteToggleIcon`).click(function () {
      self.publishFirebaseURLChanges({metagURLKey: metagURLKey, isFavoritedAction: true});
    });

    $(`#${metagURLKey} .pinnedToggleIcon`).click(function () {
      self.publishFirebaseURLChanges({metagURLKey: metagURLKey, isPinnedAction: true});
    });

    $(`#${metagURLKey} .commentAction`).click(function () {
      if (!metagTemplate) {
        metagTemplate = $(`#${metagURLKey}`).html();
        metagTemplate =
          `<div class="metag metagRank" id="fardina1" >${metagTemplate}</div>`;

        // console.log(metagTemplate);
      }

      let $newMetagComment = $(`#${metagURLKey} > .commentsSection`).append(metagTemplate);
    });
  }

  publishFirebaseURLChanges(action) {
    let metagURLKey = action.metagURLKey;
    let metagsURLFirebaseVote = this.firebaseManager.makeMetagsURLFirebaseVote(metagURLKey);
    metagsURLFirebaseVote.once("value", function (snapshot) {
      let urlData = snapshot.val();
      if (!urlData) {
        return;
        // let userChoices = {favorited: false, pinned: false};
        // let metagRanking = { votes: 0,  userChoices: userChoices};
        // urlData = {url: resultURL, metagRanking: metagRanking};
      }
      if (action.isVoteAction) {
        let increment = action.isVoteUp ? 1 : -1;
        urlData.metagRanking.votes += increment;
      }

      if (action.isFavoritedAction) {
        urlData.metagRanking.userChoices.favorited = !urlData.metagRanking.userChoices.favorited;
      }

      if (action.isPinnedAction) {
        urlData.metagRanking.userChoices.pinned = !urlData.metagRanking.userChoices.pinned;
      }

      metagsURLFirebaseVote.update(urlData);
    });
  }

}
