import * as      JSZip from        'jszip';
import * as Imposition from './imposition';


const book = new Imposition.ImpositionBook();


function processZip (zipfile : File) {
  /*
    Read a zip file's contents, converting the files into image data URLS, and
    putting them into Imposition.ImpositionImage objects. Return a promise that runs once
    all images are loaded.
  */

  return JSZip.loadAsync(zipfile).then( (zip) => {

    const images   : Array<Imposition.ImpositionImage> = book.images = [];
    const promises : Array<Promise<void>>   = [];

    // Go through each file in the zip archive. For each, create a promise, and
    // return a promise which finishes once each file-read-promise is finished

    zip.forEach( (path, file) => {
      const img = new Imposition.ImpositionImage();
      images.push(img);
      
      const promise : Promise<void> = file.async("blob").then( (blob) => {

	// Create a base64 image URI from the file contents, then use that to
	// create an image element.

	const content = URL.createObjectURL(blob);

	return new Promise( (resolve: Function, reject: Function) => {
	  img.element = document.createElement("img");

	  // Once the image is loaded, fire the Imposition.ImpositionImage class' onload
	  // event

	  img.element.addEventListener('load', (e:Event) => {
	    img.onload(e);
	    return resolve()
	  });

	  img.element.addEventListener('error', (error) => reject(error));
	  img.src = img.element.src = content;
	});
      });

      promises.push(promise);
    });
    
    return Promise.all(promises);

  }, function zipReadError(err) {
      // TODO
  });
  
}

function processImage (file : File, refresh=true) : Promise<void> {
  return new Promise<void> ( (resolve, reject) => {
    const img     = new Imposition.ImpositionImage();
    const content = URL.createObjectURL(file);
    img.src = content;
    img.element   = document.createElement("img");
    img.element.src = content;

    book.images.push(img);

    img.element.addEventListener('load', (e) => {
      img.onload(e);
      return resolve();
    });

    img.element.addEventListener('error', (error) => reject(error));
  });
}


function processUpload (file: File) {
  if (file.type == "application/zip") {
    return processZip(file);
  }
  else if (file.type.startsWith("image/")) {
    return processImage(file);
  }

  const wrong_MIME_promise = new Promise( (resolve, reject) => {
    return reject(`Expected MIME type of application/zip or image/*, got ${file.type}`);
  });
}


function uploadFiles (files: any) : Promise<void> {
  return Promise.all(
    Array.from(files).map(processUpload)
  ).then( ()=> {
    book.refresh();
    
    // Enable page view buttons and select one

    const select_real_view    = document.getElementById("select-real-view");
    const select_imposed_view = document.getElementById("select-imposed-view");

    select_real_view.removeAttribute("disabled");
    select_imposed_view.removeAttribute("disabled");
    select_real_view.click();
  });
}


declare global {
  interface Window {
    uploaderHook: Function,
  }
};


type EventHandler = (event: Event) => void;


function addEvent (listener : EventTarget, eventName: string) : (h:EventHandler) => void {
  /*
    Decorator function for adding events to EventTarget objects such as an Element, Window, or Document.

    Example usage:
      @addEvent(window, "load")
      function onWindowLoad (event) {
	...
      }
  */

  return function (eventHook: EventHandler ) : void {
    listener.addEventListener(eventName, eventHook);
  }
}


function uploaderHook (uploader: HTMLInputElement) : Promise<void> {
  return uploadFiles(uploader.files);
}


window.uploaderHook = uploaderHook;

/*
  Dragging and dropping files into the window
*/

window.ondragover = function (event) {
  event.preventDefault();
}


window.ondrop = function (event) {
  event.preventDefault();
  uploadFiles(event.dataTransfer.files);
}


/*
  Page load
*/

window.addEventListener("load", () => {
  book.real_pages    = document.getElementById("real-pages");
  book.imposed_pages = document.getElementById("imposed-pages");

  document.getElementById("right-to-left").onchange = function(e) {
    book.right_to_left = (<HTMLInputElement> e.target).checked;
    book.refresh();
  };

  document.getElementById("back-cover-toggle").onchange = function(e) {
    book.has_back_cover = (<HTMLInputElement> e.target).checked;
    book.refresh();
  };

  document.getElementById("crease-margin").onchange = function(e: Event) {
    (<HTMLInputElement> this).value = parseFloat((<HTMLInputElement> this).value).toFixed(1);
    Imposition.setMargin((<HTMLInputElement> e.target).value);
  };

  function handleViewChange (e: any) {
    document.getElementById("pages-welcome").classList.add("hidden");

    if (e.target.id == "select-real-view") {
      book.real_pages.classList.remove('hidden');
      book.imposed_pages.classList.add('hidden');
    }
    else {
      book.real_pages.classList.add('hidden');
      book.imposed_pages.classList.remove('hidden');
    }
  }

  document.getElementById("select-real-view").onchange    = handleViewChange;
  document.getElementById("select-imposed-view").onchange = handleViewChange;

});
