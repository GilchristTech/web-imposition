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
    this.images  = [];
    this.spreads = [];
    this.pages   = [];
    
    this.real_pages    = null;
    this.imposed_pages = null;

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

	side = 0;
      }
    }
  }

  refreshImposed () {
    return;
    this.imposed_page.innerHTML = "";

    this.sheets = Array(Math.ceil(this.spreads.length / 2));
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
