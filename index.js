function setMargin (margin) {
  document.documentElement.style.setProperty('--crease-margin-quantity', margin);
}

class ImpositionImage {
  constructor () {
    this.src;
    this.element;
    this.elementSecondary;

    this.single = null;
    this.hidden;
  }

  onload (e) {
    if (this.element.width > this.element.height) {
      this.element.className = "double";
      this.single = false;

      const right_img     = this.elementSecondary = document.createElement("img");
      right_img.src       = this.src;
      right_img.className = "double";
    }
    else {
      this.element.className = "single";
      this.single = true;
    }
  }
}

class ImpositionBook {
  constructor () {
    this.images        =    [];
    this.spreads       =  null;
    this.pages         =  null;
    
    // DOM elements containing individual page spreads
    this.real_pages    =  null;
    this.imposed_pages =  null;
    
    // Manga-order imposition flag
    this.right_to_left = false;
  }

  refresh () {
    this.refreshReal();
    this.refreshImposed();
  }

  refreshReal () {
    /*
      Rebuild the parts of the DOM which contain page layouts, reflowing the
      booklet page according to the order they are read.
    */

    this.real_pages.innerHTML = "";

    // Create page spread elements

    const spreads = this.spreads = [];
    this.pages = [];
    let side = 1;

    for (let image of this.images) {
      let spread;

      if (image.single) {
	if(spreads.length > 1 && side == 1) {
	  spread = spreads[spreads.length-1];
	}
	else {
	  spread = document.createElement("div");
	  spread.className = "spread";
	  this.real_pages.appendChild(spread);
	  spreads.push(spread);
	}

	let page_side = (side ^ this.right_to_left) ? "right" : "left";

	const page = document.createElement("div");
	page.className = `spread-page spread-${page_side}`;
	page.appendChild(image.element);
	spread.appendChild(page);

	this.pages.push(page);

	side = !side;
      }
      else {
	// We're processing a one-image, double-page spread

	spread = document.createElement("div");
	spread.className = "spread";
	this.real_pages.appendChild(spread);

	const page_l = document.createElement("div");
	const page_r = document.createElement("div");

	page_l.className = "spread-page spread-left";
	page_r.className = "spread-page spread-right";

	page_l.appendChild(image.element);
	page_r.appendChild(image.elementSecondary);

	spread.appendChild(page_l);
	spread.appendChild(page_r);

	this.pages.push(page_l);
	this.pages.push(page_r);

	side = 0;
      }
    }
  }

  refreshImposed () {
    this.imposed_pages.innerHTML = "";
    this.mapImposedSpreads( (spread) => this.imposed_pages.appendChild(spread) );
  }
  
  imposedSliceSpreads (start, end) {
    const imposed_spreads = Array(this.pages.length >> 1);

    // This imposition algorithm iterates through real-flow (as seen by the
    // reader) of page spreads, and uses that spread's index for calculation.

    for (
	let imposed_spread_i=0 ;
	imposed_spread_i < this.pages.length / 2 ;
	imposed_spread_i++
    ) {
      let            left_src_i  = this.pages.length - 1 - imposed_spread_i;
      let           right_src_i  = imposed_spread_i;
      
      // Depending on whether this page spread is on the front or the back of
      // the sheet, the left and right pages will alternate from taking from the
      // first or second half of the source page flow. So every other page, we
      // swap source indexes.

      if (imposed_spread_i % 2) {
	[left_src_i, right_src_i] = [right_src_i, left_src_i];
      }
      
      const    left_source_spread = this.spreads[left_src_i  >> 1];
      const   right_source_spread = this.spreads[right_src_i >> 1];
      
      const      left_source_side = (left_src_i  % 2) ? "left" : "right";
      const     right_source_side = (right_src_i % 2) ? "left" : "right";

      const  left_source_element  =  left_source_spread.getElementsByClassName(`spread-${ left_source_side}`)[0];
      const right_source_element  = right_source_spread.getElementsByClassName(`spread-${right_source_side}`)[0];
      
      // Create return elements

      const imposed_spread_element = document.createElement("div");
      imposed_spread_element.className = "spread";

      let  left_imposed_element, right_imposed_element;

      if (left_source_element) {
	left_imposed_element = left_source_element.cloneNode(true);
	imposed_spread_element.appendChild(left_imposed_element);
      }

      if (right_source_element) {
	right_imposed_element = right_source_element.cloneNode(true);
	imposed_spread_element.appendChild(right_imposed_element);
      }

      imposed_spreads[imposed_spread_i] = imposed_spread_element;
    }

    return imposed_spreads;
  }

  mapImposedSpreads (start, end, func) {
    /*
      Map a function over this.real_pages.slice(start, end) in imposed order.
      The start and end arguments are optional, and default to the start and end
      of this.real_pages.
    */

    // Process aruments based on length

    switch (arguments.length) {
      case 1: [ func, start, end ] = [ start,     0, undefined ]; break;
      case 2: [ func, start, end ] = [   end, start, undefined ]; break;
      case 3:           /* works as specified */                  break;

      default:
	throw TypeError("ImpositionBooklet.mapImposed() expects 1 to 3 arguments, got " + aguments.length);
    }

    return this.imposedSliceSpreads(start, end).map(func);
  }
}

const book = new ImpositionBook();

function processZip (zipfile) {
  JSZip.loadAsync(zipfile).then( (zip) => {

    const images = book.images = [];
    const promises = [];

    zip.forEach( (path, file) => {
      const img = new ImpositionImage();
      images.push(img);
      
      const promise = file.async("blob").then( (blob) => {
	const url = URL.createObjectURL(blob);

	return new Promise( (resolve, reject) => {
	  img.element = document.createElement("img");
	  img.element.addEventListener('load', () => { img.onload(); return resolve() });
	  img.element.addEventListener('error', (error)=> reject(error));
	  img.src = img.element.src = url;
	});
      });

      promises.push(promise);
    });
    
    Promise.all(promises).then( () => {
      book.refresh();
    });

  }, function zipReadError(err) {
      // TODO
  });
  
}


function processUpload (file) {
  switch (file.type) {
    case "application/zip":
      return processZip(file);
    case "application/img":
      return null;
    default:
      return null;
  }
}

function uploaderHook (uploader) {
  for (let file of uploader.files) {
    processUpload(file);
  }
}


window.onload = function() {
  book.real_pages = document.getElementById("real-pages");
  book.imposed_pages = document.getElementById("imposed-pages");

  document.getElementById("right-to-left").onchange = function(e) {
    book.right_to_left = e.target.checked;
    book.refresh();
  };

  document.getElementById("crease-margin").onchange = function(e) {
    this.value = parseFloat(this.value).toFixed(1);
    setMargin(e.target.value);
  };

  function handleViewChange (e) {
    if (e.target.id == "select-real-view") {
      book.real_pages.classList.remove('hidden');
      book.imposed_pages.classList.add('hidden');
    }
    else {
      book.real_pages.classList.add('hidden');
      book.imposed_pages.classList.remove('hidden');
    }
  }

  document.getElementById("select-real-view").onchange = handleViewChange;
  document.getElementById("select-imposed-view").onchange = handleViewChange;

}
