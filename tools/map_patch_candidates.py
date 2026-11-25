import numpy as np, cv2, sys, json
im=cv2.imread('/home/claude/game/assets/maps/jungle.webp').astype(np.float32); H,W=im.shape[:2]
L=[(478,0,58,72),(245,192,48,52),(108,305,58,80),(295,415,52,70),(596,160,58,80),(522,436,58,68),(106,540,60,75),(262,692,62,72),(476,856,60,70),(596,695,58,62),(806,110,60,80),(798,248,76,56),(806,598,62,70),(802,726,62,72)]
OFF=[(-64,0),(64,0),(-110,0),(110,0),(0,-80),(0,80)]
M=10
def patch(img,r,dx,dy):
    x,y,w,h=r; out=img.copy()
    X0,Y0=max(0,x-M),max(0,y-M); X1,Y1=min(W,x+w+M),min(H,y+h+M)
    yy,xx=np.mgrid[Y0:Y1,X0:X1]
    d=np.maximum(np.maximum(x-xx,xx-(x+w-1)),np.maximum(y-yy,yy-(y+h-1)))
    a=np.clip(1-d/M,0,1)[...,None]
    sy0,sx0=Y0+dy,X0+dx
    if sy0<0 or sx0<0 or Y1+dy>H or X1+dx>W: return None
    S=img[sy0:Y1+dy,sx0:X1+dx]
    out[Y0:Y1,X0:X1]=S*a+out[Y0:Y1,X0:X1]*(1-a); return out
if __name__=='__main__':
    part=int(sys.argv[1]); T=150; Z=1
    rows=L[part*7:part*7+7]
    sheet=np.zeros((T*len(rows),T*(len(OFF)+1),3),np.uint8)
    for i,r in enumerate(rows):
        cx,cy=r[0]+r[2]//2,r[1]+r[3]//2
        x0,y0=max(0,min(W-T,cx-T//2)),max(0,min(H-T,cy-T//2))
        sheet[i*T:(i+1)*T,0:T]=im[y0:y0+T,x0:x0+T]
        for j,(dx,dy) in enumerate(OFF):
            o=patch(im,r,dx,dy)
            if o is not None: sheet[i*T:(i+1)*T,(j+1)*T:(j+2)*T]=o[y0:y0+T,x0:x0+T]
            cv2.putText(sheet,f'{part*7+i}.{j}',((j+1)*T+3,i*T+12),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,255,255),1)
    cv2.imwrite(f'/tmp/view/cand{part}.png',sheet)
