
import { Peer } from 'peerjs';
import { NetworkMessage } from '../types';

type DataCallback = (data: NetworkMessage) => void;

// Generate a short 6-character ID (excluding ambiguous chars like I, 1, O, 0)
const generateShortId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

class MultiplayerManager {
  private peer: Peer | null = null;
  private connections: any[] = [];
  private onDataReceived: DataCallback | null = null;
  private myId: string = '';
  private roomName: string = 'UNO Room';

  initialize(onData: DataCallback) {
    this.onDataReceived = onData;
  }

  setRoomName(name: string) {
    this.roomName = name;
  }

  async hostGame(): Promise<string> {
    return new Promise((resolve, reject) => {
      const attemptHost = (retriesLeft: number) => {
        if (retriesLeft === 0) {
          reject(new Error("Unable to generate a unique Room ID. Please try again."));
          return;
        }

        const id = generateShortId();
        // Create peer with specific short ID
        const tempPeer = new Peer(id);

        const onError = (err: any) => {
          if (err.type === 'unavailable-id') {
            tempPeer.destroy();
            attemptHost(retriesLeft - 1);
          } else {
            reject(err);
          }
        };

        // Temporary error listener for creation phase
        tempPeer.on('error', onError);

        tempPeer.on('open', (id) => {
          tempPeer.off('error', onError); // Remove creation error handler
          
          this.peer = tempPeer;
          this.myId = id;
          console.log('Hosting game with ID:', id);
          
          // Runtime error handler
          this.peer.on('error', (err) => console.error('Peer error:', err));

          this.peer.on('connection', (conn) => {
            console.log('New client connected:', conn.peer);
            
            conn.on('open', () => {
                 this.connections.push(conn);
                 // Send Room Info immediately
                 conn.send({ type: 'ROOM_INFO', payload: { name: this.roomName } });
                 
                 // Inform app that someone joined (Update List)
                 if (this.onDataReceived) {
                     this.onDataReceived({ type: 'PLAYER_JOINED', payload: { count: this.connections.length } }); 
                 }
            });

            conn.on('data', (data: any) => {
                if (this.onDataReceived) this.onDataReceived(data);
            });
            
            conn.on('close', () => {
                // Remove closed connection
                this.connections = this.connections.filter(c => c.peer !== conn.peer);
                if (this.onDataReceived) {
                     this.onDataReceived({ type: 'PLAYER_LEFT', payload: { count: this.connections.length } });
                }
            });
          });

          resolve(id);
        });
      };

      attemptHost(5); // Try up to 5 times to get a unique ID
    });
  }

  async joinGame(hostId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Client still uses random ID (default behavior)
      this.peer = new Peer();

      this.peer.on('open', (id) => {
        this.myId = id;
        const conn = this.peer!.connect(hostId);
        
        conn.on('open', () => {
          console.log('Connected to host:', hostId);
          this.connections.push(conn);
          resolve();
        });

        conn.on('data', (data: any) => {
            if (this.onDataReceived) this.onDataReceived(data);
            
            // Handle being kicked at the protocol level
            if (data.type === 'KICKED') {
                this.disconnect();
            }
        });
        
        conn.on('close', () => {
             if (this.onDataReceived) this.onDataReceived({ type: 'KICKED' }); // Generic disconnect signal
        });

        conn.on('error', (err) => reject(err));
      });

      this.peer.on('error', (err) => reject(err));
    });
  }

  kickClient(index: number) {
      const conn = this.connections[index];
      if (conn) {
          // Send polite notice
          conn.send({ type: 'KICKED' });
          
          // Close after short delay to ensure message sends
          setTimeout(() => {
              conn.close();
          }, 100);
          
          // Update local list immediately
          this.connections.splice(index, 1);
          if (this.onDataReceived) {
              this.onDataReceived({ type: 'PLAYER_LEFT', payload: { count: this.connections.length } });
          }
      }
  }

  broadcast(msg: NetworkMessage) {
    this.connections.forEach(conn => {
        if (conn.open) conn.send(msg);
    });
  }

  sendToHost(msg: NetworkMessage) {
      // Client only has one connection (the host)
      if (this.connections.length > 0 && this.connections[0].open) {
          this.connections[0].send(msg);
      }
  }

  disconnect() {
      this.connections.forEach(c => c.close());
      this.connections = [];
      if (this.peer) this.peer.destroy();
      this.peer = null;
  }

  getId() {
      return this.myId;
  }
}

export const mpManager = new MultiplayerManager();
