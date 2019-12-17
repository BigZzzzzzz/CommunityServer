/*
 *
 * (c) Copyright Ascensio System Limited 2010-2018
 *
 * This program is freeware. You can redistribute it and/or modify it under the terms of the GNU 
 * General Public License (GPL) version 3 as published by the Free Software Foundation (https://www.gnu.org/copyleft/gpl.html). 
 * In accordance with Section 7(a) of the GNU GPL its Section 15 shall be amended to the effect that 
 * Ascensio System SIA expressly excludes the warranty of non-infringement of any third-party rights.
 *
 * THIS PROGRAM IS DISTRIBUTED WITHOUT ANY WARRANTY; WITHOUT EVEN THE IMPLIED WARRANTY OF MERCHANTABILITY OR
 * FITNESS FOR A PARTICULAR PURPOSE. For more details, see GNU GPL at https://www.gnu.org/copyleft/gpl.html
 *
 * You can contact Ascensio System SIA by email at sales@onlyoffice.com
 *
 * The interactive user interfaces in modified source and object code versions of ONLYOFFICE must display 
 * Appropriate Legal Notices, as required under Section 5 of the GNU GPL version 3.
 *
 * Pursuant to Section 7 § 3(b) of the GNU GPL you must retain the original ONLYOFFICE logo which contains 
 * relevant author attributions when distributing the software. If the display of the logo in its graphic 
 * form is not reasonably feasible for technical reasons, you must include the words "Powered by ONLYOFFICE" 
 * in every copy of the program you distribute. 
 * Pursuant to Section 7 § 3(e) we decline to grant you any rights under trademark law for use of our trademarks.
 *
*/


ProgressDialog = (function () {

    var progressStatus = {
        Queued: 0,
        Started: 1,
        Done: 2,
        Failed: 3
    };

    var loadingBanner,
        container;

    var resources, methods;

    function init(res, jqElement, met, mode) {

        if (jq("#progressDialog").length) return;
        loadingBanner = LoadingBanner;
        container = jqElement;
        resources = res;
        methods = met;

        if (mode && mode === 1) {
            jqElement.append(
                jq.tmpl("progressBarTmpl", {
                    header: resources.header || "",
                    percentage: resources.percentage || 0
                }));
        } else { // Default mode
            jqElement.append(
                jq.tmpl("progressDialogTmpl", {
                    header: resources.header || "",
                    footer: resources.footer || ""
                }));
        }

        jq("#bottomLoaderPanel").draggable(
            {
                axis: "x",
                handle: ".progress-dialog-header",
                containment: "body"
            }
        );

        jq("#progressDialog .actions-container.close").unbind("click").bind("click", terminate);

        jq("#progressDialog").off("click").on("click", ".progress-error", showErrorText);

        if (methods !== null) {
            getStatus();
        }
    }

    function showErrorText() {
        var rowIndex = jq(this).closest(".pd-row").index() + 1;

        jq(this).helper({
            BlockHelperID: "progressDialogBodyTable tr:nth-child(" + rowIndex + ") .popup_helper",
            position: "fixed"
        });
    }

    function setProgressValue(progressBar, value) {
        value = value | 0;
        progressBar = jq(progressBar);
        if (!progressBar.is("progress")) {
            progressBar = progressBar.find("progress");
        }

        var dt = 50;
        var timer = progressBar.data("timer");
        clearInterval(timer);

        var curValue = progressBar.val();
        if (!value || curValue > value) {
            progressBar.val(value);
        } else {
            var nextProgressValue = function (dValue, maxValue) {
                var v = Math.min(maxValue, progressBar.val() + dValue);
                progressBar.val(v);
                if (v == maxValue) {
                    clearInterval(timer);
                }
            };

            var dV = Math.max(1, (value - curValue) / dt);
            timer = setInterval(function () {
                nextProgressValue(dV, value);
            }, 1);
            progressBar.data("timer", timer);
        }

        var prValue = progressBar.find(".asc-progress-value");

        if (!value) {
            prValue.css("width", value + "%");
        } else {
            prValue.animate({ "width": value + "%" });
        }

        progressBar.next().text(value + "%");
    }

    function setProgress(percentage, status) {
        setProgressValue("#progressDialog progress", percentage);
        jq('#progressDialog').find('#progressDialogHeader').text(status);
    }

    function show() {
        jq("#progressDialog").show();
    }

    function close() {
        jq("#progressDialog").hide();
        jq("#progressDialogBodyTable tbody").empty();
    }

    function changeHeaderText(text) {
        jq("#progressDialogHeader").text(text);
    };

    function renderRow(tmpl, data) {
        if (jq("#" + data.id).length) return;

        function replaceSpecCharacter(str) {
            var characterRegExp = new RegExp("[\t*\+:\"<>?|\\\\/]", "gim");
            return (str || "").trim().replace(characterRegExp, "_");
        }

        data.fileName = replaceSpecCharacter(data.fileName);
        data.fileTypeCssClass = ASC.Files.Utility.getCssClassByFileTitle(data.fileName, true);

        jq("#progressDialogBodyTable tbody").append(jq.tmpl(tmpl, data));
        jq("#progressDialogBodyTable").parent().scrollTo("#" + data.id);
    }

    function setRowProgress(id, percentage) {
        setProgressValue("#" + id + " progress", percentage);
    }

    function showRowStartedStatus(id) {
        jq("#" + id)
            .removeClass("done")
            .removeClass("error")
            .addClass("started");
    }

    function showRowFailedStatus(id, errorText) {
        jq("#" + id)
            .removeClass("started")
            .removeClass("done")
            .addClass("error")
            .removeAttr("id")
            .find(".popup_helper").text(errorText);
    }

    function showRowDoneStatus(id, url) {
        jq("#" + id)
            .removeClass("started")
            .removeClass("error")
            .addClass("done")
            .removeAttr("id")
            .find(".linkMedium").attr("href", url);
    }


    function terminate() {
        if (methods === null)  return close();

        if (methods.terminate) {
            methods.terminate(
            {
                success: function() {
                    hideLoader();
                    close();
                },
                error: generateErrorCallback
            });
        } else {
            close();
        }
    };

    function generate(data) {
        showLoader();
        methods.generate(data, {
            success: generateSuccessCallback,
            error: generateErrorCallback
        });
    }

    function generateSuccessCallback(params, response) {
        if (!response || typeof(response.id) === "undefined" || jq.isEmptyObject(response)) {
            hideLoader();
            return;
        }

        renderRow("progressDialogRowTmpl", response);
        show();

        switch (response.status) {
            case progressStatus.Queued:
            case progressStatus.Started:
                var progress = typeof(response.percentage) !== "undefined" ?
                    Math.round(response.percentage) :
                    response.status === progressStatus.Queued ? 10 : 60;

                changeHeaderText(progress > 0 ? resources.progress.format(progress) : resources.header);
                setRowProgress(response.id, progress);
                showRowStartedStatus(response.id);
                setTimeout(getStatus, 1600);
                break;
            case progressStatus.Done:
            case progressStatus.Failed:
                hideLoader();
                changeHeaderText(resources.header);
                setRowProgress(response.id, 100);

                if (response.exception) {
                    showRowFailedStatus(response.id, response.exception);
                    toastr.error(response.exception);
                } else {
                    showRowDoneStatus(response.id, response.fileUrl ? response.fileUrl : ASC.Files.Utility.GetFileWebEditorUrl(response.fileId));
                }
                break;
        }
    };

    function getStatus() {
        showLoader();

        methods.status(
            {
                success: generateSuccessCallback,
                error: generateErrorCallback
            });
    };

    function generateErrorCallback(params, errors) {
        hideLoader();
        toastr.error(errors[0]);
    };

    function showLoader() {
        loadingBanner.showLoaderBtn(container);
    }

    function hideLoader() {
        loadingBanner.hideLoaderBtn(container);
    }

    return {
        init: init,
        show: show,
        close: close,
        generate: generate,
        setProgress: setProgress
    };
})();