docker build . -t fractal-vizarr-viewer

docker run --network host \
    -v $(pwd)/test_napari/allowed_users.txt:/allowed_users.txt \
    -v $(pwd)/test_napari/zarr-files:/zarr-files \
    -e ZARR_DATA_BASE_PATH=/zarr-files \
    -e FRACTAL_SERVER_URL=http://localhost:8000 \
    -e ALLOWED_USERS=/allowed_users.txt \
    fractal-vizarr-viewer

