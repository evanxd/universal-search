/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = ['RecommendationRow'];

const COLORS = ['orange', 'lightorange', 'magenta', 'purple', 'green', 'red',
                'blue', 'teal', 'grey'];
const FAVICON = {
  DEFAULT: 'chrome://mozapps/skin/places/defaultFavicon@2x.png',
  WIKIPEDIA: 'chrome://universalsearch-skin/content/wikipedia-dark.svg'
};
const IMAGE_DIMENSION = 32;
const TYPES = {
  TLD: 'tld',
  WIKIPEDIA: 'wikipedia'
};


function RecommendationRow(data, opts) {
  /*
  The RecommendationRow is a helper class that contains verbose DOM creation
  methods used to create the element managed by the Recommendation module.
  */
  this.win = opts.win;
  this.doc = opts.win.document;
  this.eTLD = opts.eTLD;
  this.io = opts.io;
  this._data = data;
  this._get = this._get.bind(this);
  this.resultType = this.getResultType(this);
}


RecommendationRow.prototype = {
  render: function() {
    /*
    Creates and returns an <hbox> element containing the fully-rendered
    recommendation.
    */
    let row = this;

    if (!this.resultType) {
      return;
    }

    let renderMethods = [
      row.renderFavicon,
      row.renderImage,
      row.renderContent,
      row.renderLabel
    ];
    let elem = createElement(this.doc, 'hbox', 'container');
    elem.setAttribute('data-result-type', row.resultType);
    renderMethods.forEach(method => {
      elem.appendChild(method(row));
    });
    return elem;
  },

  getResultType: function(row) {
  /*
  Determines and returns a TYPES property indicating the result type.
  */
    if (row._get('enhancements.tld')) {
      return TYPES.TLD;
    } else if (row._get('enhancements.wikipedia')) {
      return TYPES.WIKIPEDIA;
    }
  },

  renderFavicon: function(row) {
    /*
    Creates and returns an <image> element representing the favicon. If none is
    available, or if the URL returned from the server errors, will use
    Firefox's default favicon.
    */
    let favicon;
    if (row.resultType == TYPES.WIKIPEDIA) {
      favicon = FAVICON.WIKIPEDIA;
    } else {
      favicon = row._get('enhancements.favicon.url') || FAVICON.DEFAULT;
    }

    let wrapper = createElement(row.doc, 'vbox', 'icon');
    let elem = createElement(row.doc, 'image', 'favicon');
    wrapper.appendChild(elem);
    elem.setAttribute('src', favicon);

    row.win.fetch(favicon, {
      mode: 'no-cors'
    }).then((response) => {
      response.blob().then(imgBlob => {
        let imgUrl = row.win.URL.createObjectURL(imgBlob);
        elem.setAttribute('src', imgUrl);
      });
    }, (err) => {
      elem.setAttribute('src', defaultFavicon);
    });

    // Note that we return the element before its 'src' is set.
    return wrapper;
  },

  renderImage: function(row) {
    /*
    Creates and returns a <vbox> element containing an image-type
    representation of the recommendation. If a logo (from Clearbit) is
    available, use that. If not, but a key image (from Embedly) is available,
    use that. Otherwise, use a letterbox.
    */
    let logo = row._get('enhancements.tld');
    let keyImage = row._get('enhancements.wikipedia.image');
    let elem = createElement(row.doc, 'vbox', 'image');
    if (logo) {
      elem.appendChild(row.renderLogo(row, logo));
    } else if (keyImage) {
      elem.appendChild(row.renderKeyImage(row, keyImage));
    } else {
      return row.renderLetterbox(row);
    }
    return elem;
  },

  renderLogo: function(row, logoUrl) {
    /*
    Creates and returns an <image> element representing the logo from Clearbit,
    sized up to 2x pixel density. If it errors, render a letterbox in its
    place.
    */
    let elem = createElement(row.doc, 'image', 'logo');
    let clearbitUrl = `${logoUrl}?size=${IMAGE_DIMENSION * 2}`;

    row.win.fetch(clearbitUrl, {
      mode: 'no-cors'
    }).then((response) => {
      response.blob().then(imgBlob => {
        let logoImageUrl = row.win.URL.createObjectURL(imgBlob);
        elem.setAttribute('src', logoImageUrl);
      });
    }, (err) => {
      elem.parentNode.replaceChild(row.renderLetterbox(row), elem);
    });

    // Note that we return the element before its 'src' is set.
    return elem;
  },

  renderKeyImage: function(row, keyImage) {
    /*
    Creates and returns an <image> element containing a key image for the
    recommendation from Embedly, sized so the shorter dimension is
    IMAGE_DIMENSION pixels, and the other is sized to maintain the image's
    aspect ratio. If it errors, render a letterbox in its place.
    */
    let elem = createElement(row.doc, 'image', 'keyimage');
    let sizes = row._getKeyImageSizes(keyImage);

    elem.setAttribute('height', sizes.height);
    elem.style.height = `${sizes.height}px`;
    elem.setAttribute('width', sizes.width);
    elem.style.width = `${sizes.width}px`;

    row.win.fetch(keyImage.url, {
      mode: 'no-cors'
    }).then((response) => {
      response.blob().then(imgBlob => {
        let keyImageUrl = row.win.URL.createObjectURL(imgBlob);
        elem.setAttribute('src', keyImageUrl);
      });
    }, (err) => {
      elem.parentNode.replaceChild(row.renderLetterbox(row), elem);
    });

    // Note that we return the element before its 'src' is set.
    return elem;
  },

  renderLetterbox: function(row) {
    /*
    Creates and returns an <hbox> element containing a letterbox: a square
    containing the first letter of the base domain. If a favicon is available,
    the box's background color will be set to the favicon's dominant color with
    the foreground set to either white or black, as appropriate.
    */
    let elem = createElement(row.doc, 'hbox', 'letterbox');
    elem.textContent = row._firstLetterInBaseDomain(row);
    let colors = row._getLetterboxColors(row);
    if (colors) {
      elem.style.backgroundColor = colors.background;
      elem.style.color = colors.foreground;
    } else {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      elem.classList.add(`color-${color}`);
    }
    return elem;
  },

  renderContent: function(row) {
    /*
    Creates and returns a <vbox> element containing the recommendation's title
    and URL.
    */
    let elem = createElement(row.doc, 'vbox', 'content');
    elem.appendChild(row.renderTitle(row));
    elem.appendChild(row.renderUrl(row));
    elem.style.maxWidth = `${row._getContentMaxWidth(row)}px`;
    return elem;
  },

  renderTitle: function(row) {
    /*
    Creates and returns an <description> element containing the
    recommendation's title.
    */
    let elem = createElement(row.doc, 'description', 'title');
    if (row.resultType == TYPES.WIKIPEDIA) {
      elem.textContent = row._unescape(row._get('enhancements.wikipedia.title'));
    } else {
      elem.textContent = row._unescape(row._get('result.title'));
    }
    return elem;
  },

  renderUrl: function(row) {
    /*
    Creates and returns an <description> element containing the
    recommendation's URL.
    */
    let elem = createElement(row.doc, 'description', 'url');
    let url;
    if (row.resultType == TYPES.WIKIPEDIA) {
      url = row._unescape(row._get('enhancements.wikipedia.url'));
    } else {
      url = row._unescape(row._get('result.url'));
    }
    elem.textContent = url;
    elem.setAttribute('data-url', url);
    return elem;
  },

  renderLabel: function(row) {
    /*
    Creates and returns an <hbox> element containing the "Recommended" label.
    */
    let elem = createElement(row.doc, 'hbox', 'label');
    elem.textContent = 'Recommended';
    return elem;
  },

  _get: function(key) {
    /*
    Attempt to return a value from the recommendation data at the passed key
    string. If not set, falsy, or an empty object, return null;
    */
    const val = key.split('.').reduce(function(o, x) {
      return (typeof o == 'undefined' || o === null) ? o : o[x];
    }, this._data);
    let isEmptyObject = val => {
      return val && typeof val == 'object' && !Object.keys(val).length;
    };
    return (typeof val == 'undefined' || !val || isEmptyObject(val)) ? null : val;
  },

  _firstLetterInBaseDomain: function(row) {
    /*
    Returns the first letter of the base domain for the passed row.
    */
    let url = row._get('result.url');
    return row.eTLD.getBaseDomain(row.io.newURI(url, null, null))[0];
  },

  _getLetterboxColors: function(row) {
    /*
    Calculates and returns an object literal containing CSS background and
    foreground colors for the letterbox from the favicon.

    The background is determined by reading the most prominent color from the
    favicon. If the brightness of that value is greater than 75%, the
    foreground is black. Otherwise, it is white.
    */
    let color = row._get('enhancements.favicon.color');
    if (color) {
      const r = color[0];
      const g = color[1];
      const b = color[2];
      const brightness = ((r * 0.2126 + g * 0.7152 + b * 0.0722) / 255);
      return {
        'background': `rgb(${r}, ${g}, ${b})`,
        'foreground': brightness > 0.75 ? 'black' : 'white'
      };
    }
    return;
  },

  _getKeyImageSizes: function(keyImage) {
    /*
    Calculates and returns the display dimensions for the passed key image. The
    smaller side will be IMAGE_DIMENSION pixels long, while the longer side
    will be sized to maintain the original image's aspect ratio.
    */
    if (keyImage.width > keyImage.height) {
      return {
        'width': keyImage.width / keyImage.height * IMAGE_DIMENSION,
        'height': IMAGE_DIMENSION
      };
    }
    return {
      'width': IMAGE_DIMENSION,
      'height': keyImage.height / keyImage.width * IMAGE_DIMENSION
    };
  },

  _getContentMaxWidth: function(row) {
    /*
    This method is bad.

    It attempts to calculate the available space for the recommendation content
    (Title, URL) by subtracting a magic number from the width of the popup.

    That magic number estimates the amount of horizontal space that non-content
    elements are taking up. The calculation for that number:

      9px recommendation left padding
     16px favicon
      8px favicon right margin
     32px image/letterbox
      8px image/letterbox right margin
      8px label left margin
    100px label width (appx)
     15px recommendation right padding
    -----
    197px

    If the available space is less than 200px, we will grow the popup to ensure
    that there are at least 200px available for it.
    */
    const MIN = 200;
    const MAGIC = 197;
    const popupWidth = Math.floor(
      row.doc.getElementById('PopupAutoCompleteRichResult').width);
    const available = popupWidth - MAGIC;
    return available >= MIN ? available : MIN;
  },

  _unescape: function(txt) {
    /*
    Uses the DOMParser to safely unescape HTML entities.
    */
    let doc = new this.win.DOMParser().parseFromString(txt, 'text/html');
    return doc.documentElement.textContent;
  }
};


function createElement(doc, elementName, id) {
  /*
  Create and return a XUL-namespaced XML element `elementName` with an optional
  id attribute, prefixed with `universal-search-recommendation-`.
  */
  const ns = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
  let elem = doc.createElementNS(ns, elementName);
  elem.setAttribute('id', `universal-search-recommendation-${id}`);
  return elem;
}
