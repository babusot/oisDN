$(document).ready(() => {
  $("#prijavaOdjavaGumb").click(() => {
    let idIzbraneStranke = $("#seznamStrank").val();

    window.location = idIzbraneStranke
      ? "/prijavaOdjava/" + idIzbraneStranke
      : "/prijavaOdjava/brezStranke";
  });
});
