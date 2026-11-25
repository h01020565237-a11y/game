import numpy as np, cv2
from cand import L, OFF, patch, W
im=cv2.imread('/home/claude/game/assets/maps/jungle.webp').astype(np.float32)
pick=[0,3,0,5,3,1,5,3,1,3,1,1,1,1]
center={10,11,12,13}
for i,(r,j) in enumerate(zip(L,pick)):
    dx,dy=OFF[j]
    im=patch(im,r,dx,dy)
    if i not in center:
        x,y,w,h=r
        im=patch(im,(W-x-w,y,w,h),-dx,dy)
cv2.imwrite('/tmp/fix/clean.png',im.astype(np.uint8))
