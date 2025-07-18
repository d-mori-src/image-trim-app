let croppers = [];

const dropArea = $('#drop-area');
const previewContainer = $('#preview-container');
const downloadButtons = $('.download-all-buttons');

function validateCustomSizeOnBlur() {
    const width = parseInt($('#custom-width').val(), 10);
    const height = parseInt($('#custom-height').val(), 10);

    // どちらも未入力や非数値なら無視
    if (isNaN(width) && isNaN(height)) return;

    // 両方600未満ならアラート
    if ((isNaN(width) || width < 600) && (isNaN(height) || height < 600)) {
        alert('幅と高さの両方を600px以上にしてください。どちらか一方でも600px以上であれば許容されます。');

        // 両方クリア
        $('#custom-width').val('');
        $('#custom-height').val('');
    }
}

$('#custom-width, #custom-height').on('blur', function () {
    validateCustomSizeOnBlur();
});

function updateAllCroppersAspectRatio() {
    const width = parseInt($('#custom-width').val(), 10);
    const height = parseInt($('#custom-height').val(), 10);

    // 両方とも数値がある場合のみ更新
    if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        const ratio = width / height;

        croppers.forEach(({ cropper }) => {
            cropper.setAspectRatio(ratio);
        });
    }
}

// 入力されたら即時反映
$('#custom-width, #custom-height').on('input', function () {
    updateAllCroppersAspectRatio();
});

// ドラッグ&ドロップイベント
dropArea.on('dragover', e => {
    e.preventDefault();
    dropArea.addClass('dragover');
}).on('dragleave', () => {
    dropArea.removeClass('dragover');
}).on('drop', e => {
    e.preventDefault();
    dropArea.removeClass('dragover');
    handleFiles(e.originalEvent.dataTransfer.files);
});

// 通常のファイル選択
$('#upload').on('change', e => {
    handleFiles(e.target.files);
});

// ファイル処理メイン関数
function handleFiles(files) {
    croppers = [];
    previewContainer.empty();
    let validImageFound = false;

    const customWidth = parseInt($('#custom-width').val());
    const customHeight = parseInt($('#custom-height').val());
    const useCustomSize = customWidth > 0 && customHeight > 0;
    const aspectRatio = useCustomSize ? customWidth / customHeight : 1200 / 630;

    Array.from(files).forEach((file, index) => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                if (img.naturalWidth < 600) {
                    alert(`${file.name}：横幅600px以上の画像をアップロードしてください`);
                    return;
                }

                if (useCustomSize &&
                    (customWidth > img.naturalWidth || customHeight > img.naturalHeight)
                ) {
                    alert(`${file.name}：入力サイズが元画像より大きいですが続行します`);
                }

                validImageFound = true;
                const previewWrapper = $(`
                    <div class="preview-item">
                    <p class="original-size" id="original-size-${index}"></p>
                        <img id="preview-${index}" />
                    </div>
                `);

                const downloadBtn = createDownloadButton(index);
                previewWrapper.append(downloadBtn);
                previewContainer.append(previewWrapper);
                $(`#preview-${index}`).attr('src', img.src);

                $(`#original-size-${index}`).text(`元サイズ：${img.naturalWidth}px × ${img.naturalHeight}px`);

                const cropper = createCropper(`preview-${index}`, aspectRatio);
                croppers[index] = { cropper, file };

                if (index === files.length - 1) {
                    validImageFound ? downloadButtons.show() : downloadButtons.hide();
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Cropper生成関数
function createCropper(id, aspectRatio) {
    return new Cropper(document.getElementById(id), {
        aspectRatio,
        viewMode: 1,
        autoCropArea: 1,
    });
}

// ダウンロードボタン生成
function createDownloadButton(index) {
    return $(`
        <button data-index="${index}">トリミングしてダウンロード</button>
    `);
}

// canvas生成ロジック共通化
function createCroppedCanvas(cropper, imageElement) {
    const naturalWidth = imageElement.naturalWidth;
    const naturalHeight = imageElement.naturalHeight;

    const inputWidth = parseInt($('#custom-width').val(), 10);
    const inputHeight = parseInt($('#custom-height').val(), 10);

    const hasCustomSize = !isNaN(inputWidth) && !isNaN(inputHeight);

    const ignoreCustomSize =
        hasCustomSize && inputWidth === 1200 && inputHeight === 630;

    let width, height;

    if (!hasCustomSize || ignoreCustomSize) {
        const shouldResize = naturalWidth >= 1200 && naturalHeight >= 630;
        width = shouldResize ? 1200 : naturalWidth;
        height = shouldResize ? 630 : Math.round(naturalWidth * (630 / 1200));
    } else {
        width = inputWidth;
        height = inputHeight;
    }

    return cropper.getCroppedCanvas({
        width,
        height,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
    });
}


// 画質を変えず、200KB未満に抑える圧縮
async function compressCanvasToUnderSize(canvas, maxSizeKB = 200, minQuality = 0.6) {
    let quality = 1.0;
    let blob;

    while (quality >= minQuality) {
        blob = await new Promise(resolve =>
            canvas.toBlob(resolve, 'image/jpeg', quality)
        );
        if (blob.size / 1024 <= maxSizeKB) break;
        quality -= 0.05;
    }

    return blob;
}

// 個別ダウンロードボタン
previewContainer.on('click', 'button', async function () {
    const index = $(this).data('index');
    const { cropper, file } = croppers[index];
    const imageElement = document.getElementById(`preview-${index}`);
    const canvas = createCroppedCanvas(cropper, imageElement);
    const baseName = file.name.replace(/\.[^/.]+$/, '');

    const blob = await compressCanvasToUnderSize(canvas);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${baseName}-cropped.jpg`;
    link.click();
});

// 一括ダウンロード（個別）
$('#download-all').on('click', async () => {
    for (let index = 0; index < croppers.length; index++) {
        const { cropper, file } = croppers[index];
        const imageElement = document.getElementById(`preview-${index}`);
        const canvas = createCroppedCanvas(cropper, imageElement);
        const blob = await compressCanvasToUnderSize(canvas);
        const baseName = file.name.replace(/\.[^/.]+$/, '');

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${baseName}-cropped.jpg`;
        link.click();
    }
});

// ZIP一括ダウンロード
$('#download-zip').on('click', async () => {
    const zip = new JSZip();

    await Promise.all(
        croppers.map(async ({ cropper, file }, index) => {
            const imageElement = document.getElementById(`preview-${index}`);
            const canvas = createCroppedCanvas(cropper, imageElement);
            const blob = await compressCanvasToUnderSize(canvas);
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            zip.file(`${baseName}-cropped.jpg`, blob);
        })
    );

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'cropped-images.zip');
});
