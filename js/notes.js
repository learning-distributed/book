$(function() {
  if (typeof notes === "undefined" || !notes) return;

  $(".col-md-9").each(function() {
    let source = $(this).html();
    let replacements = [
      [new RegExp('\\<p\\>-&gt;', 'gm'), '<span class="glyphicon glyphicon-arrow-right" aria-hidden="true"></span>'],
      [':joy:', '😂'],
    ];

    for (let rep of replacements) {
      source = source.replaceAll(rep[0], rep[1]);
    }
    $(this).html(source);
  });

  $("slide").parent().addClass('slide-margin');
});

// $(function() {
//   hljs.highlightAll();
// });
