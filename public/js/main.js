let croppers = [];

const dropArea = $('#drop-area');
const previewContainer = $('#preview-container');
const downloadButtons = $('.download-all-buttons');

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

                validImageFound = true;
                const previewWrapper = $(`
                    <div class="preview-item">
                        <img id="preview-${index}" />
                    </div>
                `);

                const downloadBtn = createDownloadButton(index);
                previewWrapper.append(downloadBtn);
                previewContainer.append(previewWrapper);
                $(`#preview-${index}`).attr('src', img.src);

                const cropper = createCropper(`preview-${index}`);
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
function createCropper(id) {
    return new Cropper(document.getElementById(id), {
        aspectRatio: 1200 / 630,
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

    const shouldResize = naturalWidth >= 1200 && naturalHeight >= 630;
    const width = shouldResize ? 1200 : naturalWidth;
    const height = shouldResize ? 630 : Math.round(naturalWidth * (630 / 1200));

    return cropper.getCroppedCanvas({
        width,
        height,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
    });
}

// ファイルサイズ（重さ）を200KB未満にする関数
async function compressCanvasToUnderSize(canvas, maxSizeKB = 200, minQuality = 0.6) {
    let quality = 1.0;
    let blob = await new Promise(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', quality)
    );

    while (blob.size > maxSizeKB * 1024 && quality > minQuality) {
        quality -= 0.05;
        blob = await new Promise(resolve =>
            canvas.toBlob(resolve, 'image/jpeg', quality)
        );
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
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}-cropped.jpg`;
    link.click();
    URL.revokeObjectURL(url);
});

// 一括ダウンロード（個別）
$('#download-all').on('click', async () => {
    for (let index = 0; index < croppers.length; index++) {
        const { cropper, file } = croppers[index];
        const imageElement = document.getElementById(`preview-${index}`);
        const canvas = createCroppedCanvas(cropper, imageElement);
        const baseName = file.name.replace(/\.[^/.]+$/, '');

        const blob = await compressCanvasToUnderSize(canvas);
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseName}-cropped.jpg`;
        link.click();
        URL.revokeObjectURL(url);
    }
});

// ZIP一括ダウンロード
$('#download-zip').on('click', async () => {
    const zip = new JSZip();

    await Promise.all(
        croppers.map(async ({ cropper, file }, index) => {
            const imageElement = document.getElementById(`preview-${index}`);
            const canvas = createCroppedCanvas(cropper, imageElement);
            const baseName = file.name.replace(/\.[^/.]+$/, '');

            const blob = await compressCanvasToUnderSize(canvas);
            zip.file(`${baseName}-cropped.jpg`, blob);
        })
    );

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'cropped-images.zip');
});
