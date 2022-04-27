var sorodnik;

$(document).ready(() => {
  const drzava = document.getElementById("Country");
  const span = document.getElementById("CountryStatus");
  const iElement = span.getElementsByTagName("i");

  let isCountryOkey = false;

  let responseFromLastName;
  let primek;

  $("#LastName").keyup((r) => {
    primek = document.getElementById("LastName").value;
    let url = "/najdi_sorodnika/" + primek.toUpperCase();
    $.get(url, (data) => {
      responseFromLastName = data;
      if (responseFromLastName === "") {
        $("#dopolniPodatke").prop("disabled", true);
      } else {
        $("#dopolniPodatke").prop("disabled", false);
        let returnedName = responseFromLastName.FirstName;
        let returnedLastName = responseFromLastName.LastName;
        let rez = returnedName + " " + returnedLastName;
        $("#dopolniPodatke").prop("title", "tooltip");
        $("#dopolniPodatke").tooltip({
          content: "<p>" + rez + "<p>",
        });

        $("#dopolniPodatke").click((r) => {
          //console.log("kliknato");
          $("#LastName").val(responseFromLastName.LastName);
          $("#Fax").val(responseFromLastName.Fax);
          $("#Country").val(responseFromLastName.Country);
          $("#Phone").val(responseFromLastName.Phone);
          $("#City").val(responseFromLastName.City);
          $("#Address").val(responseFromLastName.Address);
          $("#PostalCode").val(responseFromLastName.PostalCode);
          $("#Company").val(responseFromLastName.Company);
          $("#State").val(responseFromLastName.State);

          let str = responseFromLastName.Email.indexOf("@");
          let par = responseFromLastName.Email.substring(
            str,
            responseFromLastName.Email.length
          );
          $("#Email").val(par);
          checkCountry();
          checkIfEverythingIsOkey();
        });
      }
    });
    checkIfEverythingIsOkey();
  });

  $("#stranke").change(() => {
    checkIfEverythingIsOkey();
  });

  let checkIfEverythingIsOkey = () => {
    let checkCompnay = $("#CompanyString").val() != "";
    let checkCountry = isCountryOkey;
    if (checkCompnay && checkCountry) {
      $("#Register").prop("disabled", false);
    } else {
      $("#Register").prop("disabled", true);
    }
  };

  $("#CompanyString").keyup(() => {
    checkIfEverythingIsOkey();
  });

  drzava.addEventListener("keyup", (event) => {
    checkCountry();
    checkIfEverythingIsOkey();
  });

  const checkCountry = () => {
    let vrednost = drzava.value;
    const vrednostArray = Array.from(vrednost);

    let vRedu = true;

    let nimaSumnikov = true;

    vRedu = checkForSumniki(vrednostArray) && vRedu;

    if (vrednost.length < 3 || vrednost.length > 15) vRedu = false;

    if (
      vrednostArray[0].charCodeAt() < 65 ||
      vrednostArray[0].charCodeAt() > 90
    )
      vRedu = false;

    vRedu = CheckForAll(vrednostArray) && vRedu;

    if (vRedu) {
      //console.log("V Redu")
      //iElement[0].removeAttribute("class");
      iElement[0].classList.remove("fa-times");
      iElement[0].classList.add("fa-check");
      drzava.classList.add("dovoljeno");
      isCountryOkey = true;
    } else {
      //console.log("Ni v Redu")
      isCountryOkey = false;
      iElement[0].classList.remove("fa-check");
      iElement[0].classList.add("fa-times");
      drzava.classList.remove("dovoljeno");
    }
  };

  $("#seznamRacunov").click((r) => {
    let strankaID = $("#seznamRacunov").find(":selected").val();

    $.get("/filmi-racuna/" + strankaID, (data) => {
      let nizFilmov = data;

      if (nizFilmov.length == 1) {
        let ocena = nizFilmov[0].ocena.toString().replace(".", ",");
        let imdbPovezava = "https://www.imdb.com/title/" + nizFilmov[0].imdb;

        // $("#najboljeOcenjeniFilm").text("GAS");
        $("#najboljeOcenjeniFilm").html(
          "Edini film na računu je <a href=" +
            imdbPovezava +
            "target=_blank>" +
            nizFilmov[0].opisArtikla +
            " </a>" +
            " z oceno " +
            ocena +
            "."
        );
      } else {
        let najveciFilm = vrniFilmZNajvecjoOceno(nizFilmov);
        let najvecjaOcena = najveciFilm.ocena;
        let imdbPovezava = "https://www.imdb.com/title/" + najveciFilm.imdb;
        $("#najboljeOcenjeniFilm").html(
          "Najbolje ocenjeni film na računu je <a href=" +
            imdbPovezava +
            " target=_blank/>" +
            najveciFilm.opisArtikla +
            "</a>" +
            " z oceno " +
            najvecjaOcena.toString().replace(".", ",") +
            "."
        );
      }
    });
  });
  //kraj na prethdonata
}); // kraj na when ready

const CheckForAll = (nizVChar) => {
  let check = true;
  for (let i = 0; i < nizVChar.length; ++i) {
    if (
      checkIfSpaceOrSpecialSign(nizVChar[i].charCodeAt()) ||
      CheckIfLoweLatter(nizVChar[i].charCodeAt()) ||
      CheckIfUpperLatter(nizVChar[i].charCodeAt())
    ) {
      //console.log("gas");
    } else {
      check = false;
    }
    //console.log(checkIfSpaceOrSpecialSign(nizVChar[i].charCodeAt()));
  }

  return check;
};

const checkForSumniki = (niz) => {
  let checkForSum = true;

  for (let c; c < niz.length; ++c) {
    if (
      niz[c] === "š" ||
      niz[c] === "Š" ||
      niz[c] === "đ" ||
      niz[c] === "Đ" ||
      niz[c] === "č" ||
      niz[c] === "Č" ||
      niz[c] === "ž" ||
      niz[c] === "Ž"
    )
      checkForSum = false;
  }

  return checkForSum;
};

const CheckIfUpperLatter = (index) => {
  if (index >= 65 && index <= 90) return true;
  else return false;
};

const CheckIfLoweLatter = (index) => {
  if (index >= 97 && index <= 122) return true;
  else return false;
};

const checkIfSpaceOrSpecialSign = (index) => {
  if (index === 32 || index === 39) return true;
  else return false;
  //najboljeOcenjeniFilm
  
};

let vrniFilmZNajvecjoOceno = function (nizFilmov) {
  let temp = nizFilmov[0];
  for (let i = 1; i < nizFilmov.length; ++i) {
    if (nizFilmov[i].ocena > temp.ocena) temp = nizFilmov[i];
  }
  return temp;
};
